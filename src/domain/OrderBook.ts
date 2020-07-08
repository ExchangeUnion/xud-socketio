import {Orders} from "../proto/xudrpc_pb";
import PriceEntry from "./PriceEntry";
import BigDecimal from "./BigDecimal";
import {RoundingMode} from "big.js";

export default class OrderBook {
    version: number;
    asks: PriceEntry[];
    bids: PriceEntry[];

    constructor();
    constructor(version: number, asks: PriceEntry[], bids: PriceEntry[]);
    constructor(version?: number, asks?: PriceEntry[], bids?: PriceEntry[]) {
        this.version = version || 0
        this.asks = asks || []
        this.bids = bids || []
    }

    public static from(source: Orders.AsObject): OrderBook {
        const target = new OrderBook();
        target.version = null;
        target.asks = source.sellOrdersList.map(item => PriceEntry.from(item)) || [];
        target.bids = source.buyOrdersList.map(item => PriceEntry.from(item)) || [];
        return target
    }

    public toString(): string {
        let result = ""
        result += `\n---------- OrderBook (${this.version}) ----------\n`
        result += "ASKS:\n"
        this.asks.forEach(i => {
            result += `- ${i.price.toString()}: ${i.amount.toString()}\n`
        })
        result += "BIDS:\n"
        this.bids.forEach(i => {
            result += `- ${i.price.toString()}: ${i.amount.toString()}\n`
        })
        result += "-------------------------------------\n"
        return result
    }

    private difference(m1: Map<string, PriceEntry>, m2: Map<string, PriceEntry>): PriceEntry[] {
        return Array.from(m1.values()).filter(i => !m2.has(i.price.toString()))
    }

    private intersection(m1: Map<string, PriceEntry>, m2: Map<string, PriceEntry>): PriceEntry[] {
        return Array.from(m1.values()).filter(i => m2.has(i.price.toString()) && !i.amount.eq(m2.get(i.price.toString()).amount))
    }

    private diffEntries(e1: PriceEntry[], e2: PriceEntry[]): Array<PriceEntry> {
        const m1 = new Map(e1.map(i => [i.price.toString(), i]));
        const m2 = new Map(e2.map(i => [i.price.toString(), i]));

        let removed = this.difference(m1, m2);
        let added = this.difference(m2, m1);
        let changed = this.intersection(m2, m1);

        return [
            ...removed.map(i => new PriceEntry(i.price, new BigDecimal("0"))),
            ...added.map(i => new PriceEntry(i.price, i.amount)),
            ...changed.map(i => new PriceEntry(i.price, i.amount)),
        ].sort(PriceEntry.comparator)
    }

    public diff(other: OrderBook): OrderBook | null {
        const diff = new OrderBook(this.version + 1,
            this.diffEntries(this.asks, other.asks),
            this.diffEntries(this.bids, other.bids))
        if (diff.asks.length === 0 && diff.bids.length === 0) {
            return null
        }
        return diff
    }

    public merged(spread: string): OrderBook {
        const result = new OrderBook()
        result.version = this.version
        let s = new BigDecimal(spread);
        if (s.c.length !== 1 || s.c[0] !== 1) {
            throw new Error("Invalid spread: " + spread)
        }
        const f = (i: PriceEntry) => {
            let p = i.price.round(-s.e, RoundingMode.RoundUp);
            return new PriceEntry(p, i.amount);
        }
        const cmpAsk = (a: PriceEntry, b: PriceEntry) => a.price.cmp(b.price)
        const cmpBid = (a: PriceEntry, b: PriceEntry) => b.price.cmp(a.price)
        const reducer = (sum: PriceEntry[], cur: PriceEntry) => {
            if (sum.length == 0) {
                return [cur];
            } else {
                const s = sum[sum.length - 1];
                if (s.price.eq(cur.price)) {
                    s.amount = s.amount.add(cur.amount)
                    return sum
                } else {
                    return [...sum, cur]
                }
            }
        }
        result.asks = this.asks.map(f).sort(cmpAsk).reduce(reducer, [])
        result.bids = this.bids.map(f).sort(cmpBid).reduce(reducer, [])
        return result
    }
}
