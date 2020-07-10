import OrderBook from "./OrderBook";
import PriceEntry from "./PriceEntry";

function f(book: OrderBook) {
    return {
        version: book.version,
        asks: book.asks.map(i => {
            return `${i.price.toString()} ${i.amount.toString()}`
        }),
        bids: book.bids.map(i => {
            return `${i.price.toString()} ${i.amount.toString()}`
        }),
    }
}

test("OrderBook#diff null", () => {
    let book1 = new OrderBook();
    book1.asks = [
        new PriceEntry("1","1")
    ]

    let book2 = new OrderBook();
    book2.asks = [
        new PriceEntry("1", "1")
    ]

    expect(book1.diff(book2)).toBeNull()
});

test("OrderBook#diff removed", () => {
    let book1 = new OrderBook();
    book1.asks = [
        new PriceEntry("1","1")
    ]

    let book2 = new OrderBook();
    book2.asks = [
    ]

    expect(f(book1.diff(book2))).toMatchObject({
        version: 1,
        asks: [
            "1 0",
        ],
        bids: [

        ]
    })
});

test("OrderBook#diff changed", () => {
    let book1 = new OrderBook();
    book1.asks = [
        new PriceEntry("1","1")
    ]

    let book2 = new OrderBook();
    book2.asks = [
        new PriceEntry("1","1.1")
    ]

    expect(f(book1.diff(book2))).toMatchObject({
        version: 1,
        asks: [
            "1 1.1",
        ],
        bids: [

        ]
    })
});

test("OrderBook#diff added", () => {
    let book1 = new OrderBook();
    book1.asks = [
        new PriceEntry("1","1")
    ]

    let book2 = new OrderBook();
    book2.asks = [
        new PriceEntry("1","1.1"),
        new PriceEntry("2", "2")
    ]

    expect(f(book1.diff(book2))).toMatchObject({
        version: 1,
        asks: [
            "1 1.1",
            "2 2",
        ],
        bids: [

        ]
    })
});

test("OrderBook#merged", () => {
    const book = new OrderBook();
    book.asks = [
        new PriceEntry("0.11", "1"),
        new PriceEntry("0.2", "1"),
    ]

    expect(f(book.merged("0.1"))).toMatchObject({
        version: 0,
        asks: [
            "0.2 2"
        ],
        bids: [

        ]
    })

    expect(f(book.merged("0.01"))).toMatchObject({
        version: 0,
        asks: [
            "0.11 1",
            "0.2 1",
        ],
        bids: [

        ]
    })

    expect(f(book.merged("1"))).toMatchObject({
        version: 0,
        asks: [
            "1 2",
        ],
        bids: [

        ]
    })
})


test("OrderBook#merged order", () => {
    const book = new OrderBook();
    book.asks = [
        new PriceEntry("0.21", "1"),
        new PriceEntry("0.11", "1"),
        new PriceEntry("0.2", "1"),
    ]
    book.bids = [
        new PriceEntry("0.01", "1"),
        new PriceEntry("0.09", "1"),
        new PriceEntry("0.101", "1"),
    ]


    expect(f(book.merged("0.1"))).toMatchObject({
        version: 0,
        asks: [
            "0.2 2",
            "0.3 1"
        ],
        bids: [
            "0.2 1",
            "0.1 2",
        ]
    })
})
