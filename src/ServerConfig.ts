export class XudConfig {
    rpchost: string = null
    rpcport: string = null
    rpccert: string = null
}

export class PairsConfig {
    weight: {[key: string]: number}
}

export default class ServerConfig {
    xud: XudConfig = new XudConfig()
    pairs: PairsConfig = new PairsConfig()

    constructor() {
        const parser = require("yargs")
            .option("xud.rpchost", {
                type: "string",
                describe: "Specify the host of Xud gRPC interface"
            })
            .option("xud.rpcport", {
                type: "number",
                describe: "Specify the port of Xud gRPC interface"
            })
            .option("xud.rpccert", {
                type: "string",
                describe: "Specify the TLS certification file of Xud gRPC interface"
            })
            // .demandOption(["xud.rpchost", "xud.rpcport", "xud.rpccert"],
            //     "Please specify these options to let the server communicate with Xud backend")
            .option("pairs.weight", {
                type: "string",
                describe: "Specify the weight of trading pairs which is used to reorder the pairs. E.g. eth_btc:2,ltc_btc:1"
            })
            .help()

        const argv = parser.parse()

        this.xud.rpchost = argv.xud.rpchost
        this.xud.rpcport = argv.xud.rpcport
        this.xud.rpccert = argv.xud.rpccert

        this.pairs.weight = {}
        let value = ""
        try {
            value = argv.pairs.weight || ""
        } catch (e) {}
        value = value.trim()
        try {
            if (value.length > 0) {
                for (const part of value.split(",")) {
                    const [pair, weight] = part.trim().split(":")
                    this.pairs.weight[pair] = parseInt(weight)
                }
            }
        } catch (error) {
            throw new Error("Failed to parse --pairs.weight value: " + value)
        }
    }
}
