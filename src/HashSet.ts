export interface Hashable {
    hashCode(): string
}


export default class HashSet<T extends Hashable> implements Iterable<T> {

    private values: Map<string, T>

    constructor(items: Array<T>) {
        this.values = new Map(items.map(i => [i.hashCode(), i]))
    }

    public intersection(other: HashSet<T>): HashSet<T> {
        return new HashSet(Array.from(this.values.values()).filter(i => other.contains(i)))
    }

    public difference(other: HashSet<T>): HashSet<T> {
        return new HashSet(Array.from(this.values.values()).filter(i => ! other.contains(i)))
    }

    public contains(item: T): boolean {
        return this.values.has(item.hashCode())
    }

    public get(item: T): T {
        return this.values.get(item.hashCode())
    }

    [Symbol.iterator](): Iterator<T> {
        return this.values.values()
    }
}
