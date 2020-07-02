export class XudConfig {
    rpchost: string = null
    rpcport: string = null
    rpccert: string = null
}

export default class ServerConfig {
    xud: XudConfig = new XudConfig()

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
            .help()

        const argv = parser.parse()

        this.xud.rpchost = argv.xud.rpchost
        this.xud.rpcport = argv.xud.rpcport
        this.xud.rpccert = argv.xud.rpccert
    }
}
