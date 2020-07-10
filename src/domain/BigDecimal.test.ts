import BigDecimal from "./BigDecimal";
import {RoundingMode} from "big.js";

test("BigDecimal 0.1", () => {
    let n = new BigDecimal("0.1")
    expect(n.c).toMatchObject([1])
    expect(n.e).toBe(-1)

    n = new BigDecimal("0.01")
    expect(n.c).toMatchObject([1])
    expect(n.e).toBe(-2)

    n = new BigDecimal("1e-8")
    expect(n.c).toMatchObject([1])
    expect(n.e).toBe(-8)

    n = new BigDecimal("10")
    expect(n.c).toMatchObject([1])
    expect(n.e).toBe(1)

    n = new BigDecimal("1e8")
    expect(n.c).toMatchObject([1])
    expect(n.e).toBe(8)
})

test("BigDecimal round", () => {
    let n = new BigDecimal("1.1")
    expect(n.round(1, RoundingMode.RoundUp).toString()).toBe("1.1")
    expect(n.round(0, RoundingMode.RoundUp).toString()).toBe("2")
})

test("BigDecimal zero", () => {
    expect(new BigDecimal("0").toString()).toBe("0");
    expect(new BigDecimal("0.00").toString()).toBe("0");
    expect(new BigDecimal("00.0").toString()).toBe("0");
    expect(new BigDecimal("-0").toString()).toBe("0");
    expect(new BigDecimal("-0.0").toString()).toBe("0");
})

test("BigDecimal decimals", () => {
    expect(new BigDecimal("0.1").toString()).toBe("0.1");
    expect(new BigDecimal("0.10").toString()).toBe("0.1");
    expect(new BigDecimal("0.100").toString()).toBe("0.1");
    expect(new BigDecimal("1e-1").toString()).toBe("0.1");
    expect(new BigDecimal("10e-2").toString()).toBe("0.1");
})

test("BigDecimal 0.029", () => {
    let n1 = new BigDecimal("0.0291111")
    expect(n1.e).toBe(-2)
    expect(- n1.e + n1.c.length - 1).toBe(7) // decimal digits count

    let n2 = new BigDecimal("29111.99")
    expect(n2.e).toBe(4)
    expect(- n2.e + n2.c.length - 1).toBe(2) // decimal digits count
})
