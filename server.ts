import { WebSocket, WebSocketServer } from "https://deno.land/x/websocket/mod.ts";
import rand from 'https://deno.land/x/rand/mod.ts';

const wss = new WebSocketServer(8080);

type PlayerInfo = { name: string, ws: WebSocket }
const map = new Map<string, { player1: PlayerInfo, player2: PlayerInfo | null }>();

function success(ws: WebSocket, data?: { roomId: string } | { message: string }) {
    return send(ws, true, data, undefined)
}

function fail(ws: WebSocket, error: { reason: string }) {
    return send(ws, false, undefined, error)
}

function send(ws: WebSocket, success: boolean = true, data: { roomId: string } | { message: string } | undefined, error: { reason: string } | undefined) {
    ws.send(JSON.stringify({ success, data, error }));
}

function createRoom(ws: WebSocket, { name }: { name: string }) {
    const roomId = rand.u13().toString().padStart(4, '0');
    map.set(roomId, { player1: { name, ws }, player2: null });
    success(ws, { roomId })
}

function join(ws: WebSocket, { roomId, name }: { roomId: string, name: string }) {
    const roomInfo = map.get(roomId);
    if (!roomInfo) {
        fail(ws, { reason: '查無此房！' })
        return;
    }
    roomInfo.player2 = { name, ws: ws };
    success(roomInfo.player1.ws, { message: `${name} JOIN!` })
    success(ws)
    console.log(map);
}

function fire(ws: WebSocket, message: string) {

}

const router: { [key: string]: (ws: WebSocket, data: any) => void } = {
    'NEW': createRoom,
    'JOIN': join,
    'FIRE': fire,
}

wss.on("connection", function (ws: WebSocket) {
    ws.on("message", function (message: string) {
        console.log(message);
        const { action, data } = JSON.parse(message);
        if (!router.hasOwnProperty(action)) {
            console.error('Route not found.');
            fail(ws, { reason: 'Route not found.' });
            return;
        }
        router[action](ws, data);
    });

    ws.on("close", function (code: number) {
        console.log('close', code);
    })
});

wss.on("error", (e: any) => {
    console.error('err', e);
})

