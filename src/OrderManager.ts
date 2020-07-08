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
    Orders,
} from "./proto/xudrpc_pb";
import * as grpc from "grpc";
import * as winston from "winston";
import {BasicInfo, OrderBook} from "./domain";


function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export default class OrderManager {

    private readonly xudClient: XudClient;
    private readonly io: socketio.Server;
    private readonly books: { [key: string]: OrderBook };
    private readonly ready: Promise<void>;
    private basicInfo: BasicInfo;
    private logger: winston.Logger;

    constructor(xudClient: XudClient, io: socketio.Server) {
        this.xudClient = xudClient;
        this.io = io;
        this.books = {};
        this.ready = this.init();
        this.logger = winston.createLogger({
            transports: [
                new winston.transports.Console({
                    level: "debug",
                    format: winston.format.printf(info => `${info.message}`)
                })
            ]
        })
    }

    private async init(): Promise<void> {
        let info;
        while (true) {
            try {
                info = await this.getInfo();
                break;
            } catch (e) {
                this.logger.debug("Wait for xud to be ready: " + e)
            }
            await delay(3000);
        }
        const basicInfo = new BasicInfo();
        basicInfo.version = info.version;
        basicInfo.network = info.network;
        basicInfo.nodePubKey = info.nodePubKey;
        basicInfo.nodeAlias = info.alias;
        this.basicInfo = basicInfo;
        const pairs = await this.listPairs();
        pairs.pairsList.forEach((pair) => this.addPair(pair));

        // await this.subscribeOrders();
    }

    private addPair(pair: string) {
        if (pair in this.books) {
            return
        }
        pair = this.normalizePair(pair)
        this.books[pair] = new OrderBook();
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

    private ordersToString(orders: Orders.AsObject): string {
        let result = "\n"
        orders.buyOrdersList.forEach(i => {
            result += `- ${i.price} ${i.quantity}\n`;
        })
        orders.sellOrdersList.forEach(i => {
            result += `- ${i.price} ${i.quantity}\n`;
        })
        return result;
    }

    private async pollOrders() {
        while (true) {
            let orders
            try {
                orders = await this.listOrders();
            } catch (e) {
                this.logger.debug("Failed to fetch orders: " + e)
                await delay(5000)
                continue
            }

            orders.ordersMap.forEach(([key, value]) => {
                const pair = this.normalizePair(key);

                let book: OrderBook;
                if (pair in this.books) {
                    book = this.books[pair];
                } else {
                    book = new OrderBook();
                    this.books[pair] = book;
                }
                const newBook = OrderBook.from(value).merged("1e-8")
                const diff = book.diff(newBook);
                this.logger.debug(`[${pair}] current ${book.toString()} new ${newBook.toString()} diff ${diff}`)
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

    public snapshot(pair: string, spread: string): OrderBook {
        return this.books[pair].merged(spread)
    }

    get pairs(): Array<string> {
        return Object.keys(this.books)
    }

    get info(): BasicInfo {
        return this.basicInfo;
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
