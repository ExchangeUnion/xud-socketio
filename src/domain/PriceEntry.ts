import {Hashable} from "./HashSet";
import BigDecimal from "./BigDecimal";
import {Order} from "../proto/xudrpc_pb";

export default class PriceEntry implements Hashable {
    price: BigDecimal;
    amount: BigDecimal;

    public static from(source: Order.AsObject): PriceEntry {
        return new PriceEntry(
            new BigDecimal(source.price.toString()),
            new BigDecimal(source.quantity.toString()).div(100000000),
        );
    }

    constructor(price: BigDecimal, amount: BigDecimal);
    constructor(price: string, amount: string);
    constructor(price: BigDecimal | string, amount: BigDecimal | string) {
        this.price = price instanceof BigDecimal ? price: new BigDecimal(price);
        this.amount = amount instanceof BigDecimal ? amount: new BigDecimal(amount);
    }

    public static comparator(order1: PriceEntry, order2: PriceEntry): number {
        return order1.price.cmp(order2.price);
    }

    hashCode(): string {
        return this.price.toString();
    }
}
