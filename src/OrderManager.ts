import {XudClient} from "./proto/xudrpc_grpc_pb";
import * as socketio from "socket.io";
import {
    GetInfoRequest,
    GetInfoResponse,
    ListOrdersRequest,
    ListOrdersResponse, OrderUpdate,
    SubscribeOrdersRequest,
    ListPairsRequest,
    ListPairsResponse,
    Order as _Order,
    Orders,
} from "./proto/xudrpc_pb";
import * as grpc from "grpc";
import BigDecimal from "./BigDecimal";
import HashSet, {Hashable} from "./HashSet";

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

class Owner {
    nodePubKey: string;
    alias?: string;
}

class Order implements Hashable {
    id: string;
    price: BigDecimal;
    amount: BigDecimal;
    owner: Owner;

    public static from(source: _Order.AsObject): Order {
        const target = new Order();
        target.id = source.id;
        target.price = new BigDecimal(source.price.toString());
        target.amount = new BigDecimal(source.quantity.toString()).div(100000000);
        const owner = new Owner()
        owner.nodePubKey = source.nodeIdentifier.nodePubKey
        owner.alias = source.nodeIdentifier.alias
        target.owner = owner
        return target;
    }

    constructor(id?: string, price?: BigDecimal, amount?: BigDecimal, owner?: Owner) {
        this.id = id;
        this.price = price;
        this.amount = amount;
        this.owner = owner;
    }

    public static comparator(order1: Order, order2: Order): number {
        return order1.price.cmp(order2.price);
    }

    hashCode(): string {
        return this.id;
    }

}

class OrderBook {
    version: number;
    asks: Array<Order>;
    bids: Array<Order>;

    constructor(version?: number, asks?: Array<Order>, bids?: Array<Order>) {
        this.version = version || 0
        this.asks = asks || []
        this.bids = bids || []
    }

    public static from(source: Orders.AsObject): OrderBook {
        const target = new OrderBook();
        target.version = null;
        target.asks = source.sellOrdersList.map(item => Order.from(item)) || [];
        target.bids = source.buyOrdersList.map(item => Order.from(item)) || [];
        return target
    }
}

export default class OrderManager {

    private readonly xudClient: XudClient;
    private readonly io: socketio.Server;
    private readonly orders: { [key: string]: OrderBook };
    private readonly ready: Promise<void>;

    constructor(xudClient: XudClient, io: socketio.Server) {
        this.xudClient = xudClient;
        this.io = io;
        this.orders = {};
        this.ready = this.init();
    }

    private async init(): Promise<void> {
        const info = await this.getInfo();
        const version = info.version;
        const pairsCount = info.numPairs;
        const pairs = await this.listPairs();
        pairs.pairsList.forEach((pair) => this.addPair(pair));

        // await this.subscribeOrders();
    }

    private addPair(pair: string) {
        if (pair in this.orders) {
            return
        }
        pair = this.normalizePair(pair)
        this.orders[pair] = new OrderBook();
    }

    private async getInfo(): Promise<GetInfoResponse.AsObject> {
        return await new Promise((resolve, reject) => {
            const request = new GetInfoRequest();
            this.xudClient.getInfo(request, (error: grpc.ServiceError, response: GetInfoResponse) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(response.toObject());
            });
        });
    }

    private async listPairs(): Promise<ListPairsResponse.AsObject> {
        return await new Promise((resolve, reject) => {
            const request = new ListPairsRequest();
            this.xudClient.listPairs(request, (error: grpc.ServiceError, response: ListPairsResponse) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(response.toObject());
            });
        });
    }

    private async listOrders(): Promise<ListOrdersResponse.AsObject> {
        const request = new ListOrdersRequest();
        return new Promise((resolve, reject) => this.xudClient.listOrders(request, (error: grpc.ServiceError, response: ListOrdersResponse) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(response.toObject());
        }));
    }

    private diffOrders(orders1: Array<Order>, orders2: Array<Order>): Array<Order> {
        const s1 = new HashSet(orders1);
        const s2 = new HashSet(orders2);

        let removed = Array.from(s1.difference(s1));
        let added = Array.from(s2.difference(s1));
        let changed = Array.from(s2.intersection(s1));

        return [
            ...removed.map(i => new Order(i.id, i.price, new BigDecimal("0"), i.owner)),
            ...added.map(i => new Order(i.id, i.price, i.amount, i.owner)),
            ...changed.map(i => new Order(i.id, i.price, i.amount, i.owner)),
        ].sort(Order.comparator)
    }

    private diffOrderBook(oldBook: OrderBook, newBook: OrderBook): OrderBook | null {
        const diff = new OrderBook(oldBook.version + 1,
            this.diffOrders(oldBook.asks, newBook.asks),
            this.diffOrders(oldBook.bids, newBook.bids))
        if (diff.asks.length === 0 && diff.bids.length === 0) {
            return null
        }
        return diff
    }

    private async pollOrders() {
        while (true) {
            const orders = await this.listOrders();
            console.log("listOrders result is", orders)
            orders.ordersMap.forEach(([key, value]) => {
                const pair = this.normalizePair(key);
                let book: OrderBook;
                if (pair in this.orders) {
                    book = this.orders[pair];
                } else {
                    book = new OrderBook();
                    this.orders[pair] = book;
                }
                console.log("current order book is", pair, book)
                const newBook = OrderBook.from(value)
                const diff = this.diffOrderBook(book, newBook);
                this.printOrderBook(diff)
                if (diff != null) {
                    book.version = diff.version;
                    book.asks = newBook.asks;
                    book.bids = newBook.bids;
                    const event = this.eventKey(pair);
                    this.io.emit(event, JSON.stringify(diff))
                }
            });
            await delay(5000)
        }
    }

    private printOrderBook(book: OrderBook, snapshot: boolean = true) {
        if (book) {
            console.log("----------OrderBook (Delta)----------")
            console.log("VERSION:", book.version)
            console.log("ASKS:")
            book.asks.forEach(i => {
                console.log(i.price.toString(), i.amount.toString())
            })
            console.log("BIDS:")
            book.bids.forEach(i => {
                console.log(i.price.toString(), i.amount.toString())
            })
            console.log("------------------------------------")
        } else {
            console.log("Empty OrderBook")
        }

    }

    private eventKey(pair: string) {
        return `orders/${pair}`
    }

    private async subscribeOrders(): Promise<void> {
        const request = new SubscribeOrdersRequest();
        const subscription = this.xudClient.subscribeOrders(request);
        subscription.on("data", (update: OrderUpdate) => {
            const {order, orderRemoval} = update.toObject()
            if (order !== undefined) {
                const room = `r/orders/${this.normalizePair(order.pairId)}`;
                this.io.to(room).emit(room, JSON.stringify(order));
            } else if (orderRemoval !== undefined) {
                const room = `r/orders/${this.normalizePair(orderRemoval.pairId)}`;
                this.io.to(room).emit(room, JSON.stringify(orderRemoval));
            }
        });
        // TODO cancel subscription when OrderManager destroyed
    }

    public snapshot(pair: string): OrderBook {
        return this.orders[pair];
    }

    get pairs(): Array<string> {
        return Object.keys(this.orders)
    }

    private normalizePair(pairId: string) {
        const [quote, base] = pairId.split("/")
        return `${quote.toLowerCase()}_${base.toLowerCase()}`
    }

    public async start() {
        await this.ready
        await this.pollOrders()
    }
}
