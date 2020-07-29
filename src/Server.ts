import * as express from "express";
import * as socketio from "socket.io";
import * as fs from "fs";
import * as grpc from "grpc";
import {XudClient} from './proto/xudrpc_grpc_pb';
import OrderManager from "./OrderManager";
import ServerConfig from "./ServerConfig";
import * as moment from "moment";
import {Request} from "express";


function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms) );
}

export default class Server {

    config: ServerConfig

    constructor(config: ServerConfig) {
        this.config = config
    }

    async createXudClient(): Promise<XudClient> {
        const cert = fs.readFileSync(this.config.xud.rpccert);
        const credential = grpc.credentials.createSsl(cert);
        const address = `${this.config.xud.rpchost}:${this.config.xud.rpcport}`;
        console.log("Try to connect to Xud gRPC interface: " + address)
        const options = {
            'grpc.ssl_target_name_override': 'localhost',
            'grpc.default_authority': 'localhost',
        }
        const client = new XudClient(address, credential, options);
        const deadline = moment(new Date()).add(3, 's').toDate()
        await new Promise((resolve, reject) => {
            client.waitForReady(deadline, (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve()
                }
            })
        });
        return client
    }

    public async start() {
        const app = express();
        app.set("port", process.env.PORT || 8080);

        let http = require("http").Server(app);

        let io = socketio(http, {
            path: "/api-ws"
        });

        app.use(express.static("public"))

        const xudClient = await this.createXudClient();
        console.log("xudClient is created")
        const orderManager = new OrderManager(xudClient, io, this.config.pairs.weight);
        orderManager.start()

        app.get("/api/orders/:pair", (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            let spread: string
            if (req.query.spread) {
                spread = req.query.spread as string;
            } else {
                spread = "1e-8"
            }
            res.send(JSON.stringify(orderManager.snapshot(req.params.pair, spread)))
        })

        app.get("/api/pairs", (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(orderManager.pairs))
        })

        app.get("/api/info", (req, res) => {
            res.setHeader('Content-Type', 'application/json');
            res.send(JSON.stringify(orderManager.info))
        })

        http.listen(8080, () => {
            console.log("listen on 127.0.0.1:8080");
            io.on("connection", (socket) => {
                // TODO add logging framework
                console.log("a user connected");
            });
        });
    }
}


