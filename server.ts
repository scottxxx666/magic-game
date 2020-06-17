import { WebSocket, WebSocketServer } from "https://deno.land/x/websocket/mod.ts";
import rand from 'https://deno.land/x/rand/mod.ts';
import { GameProgressResponse, MessageResponse, ResponseType, RoomInfo, RoomResponse } from "./response.ts";

const wss = new WebSocketServer(8080);

const map = new Map<string, RoomInfo>();

function broadcast(roomInfo: RoomInfo, type: ResponseType, data: RoomResponse | MessageResponse | GameProgressResponse) {
    Object.values(roomInfo).map(e => e?.ws.send(JSON.stringify({ success: true, type, data })));
}

function success(ws: WebSocket, type: ResponseType, data: RoomResponse | MessageResponse | GameProgressResponse) {
    return ws.send(JSON.stringify({ success: true, type, data }))
}

function fail(ws: WebSocket, error: { reason: string }) {
    return ws.send(JSON.stringify({ success: false, type: 'Error', error }))
}

function createRoom(ws: WebSocket, { name }: { name: string }) {
    const roomId = rand.u13().toString().padStart(4, '0');
    map.set(roomId, { player1: { name, ws, blood: 3 }, player2: null });
    success(ws, ResponseType.Room, { roomId })
}

function join(ws: WebSocket, { roomId, name }: { roomId: string, name: string }) {
    const roomInfo = map.get(roomId);
    if (!roomInfo) {
        fail(ws, { reason: '查無此房！' })
        return;
    }
    roomInfo.player2 = { name, ws: ws, blood: 3 };
    success(roomInfo.player1.ws, ResponseType.OtherJoin, { message: `${name} Join!` })
    success(ws, ResponseType.JoinSuccess, { roomId, message: `Join ${roomInfo.player1.name}'s game!` })

    let i = 3;
    const id = setInterval(() => {
        broadcast(roomInfo, ResponseType.Message, { message: i.toString() });
        i--;
        if (i === 0) {
            clearInterval(id);
            if (roomInfo.player2) {
                // start(roomInfo.player1.ws, roomInfo.player2.ws);
                start(roomInfo);
            }
        }
    }, 1000);
}

function attack(ws: WebSocket, { roomId, name, type }: { roomId: string, name: string, type: number }) {
    const roomInfo = map.get(roomId);
    if (!attack1Type && roomInfo?.player1.name === name) {
        attack1Type = type;
    } else if (!attacks2[length - 1] && roomInfo?.player2?.name === name) {
        attack2Type = type;
    }
}

const router: { [key: string]: (ws: WebSocket, data: any) => void } = {
    'NEW': createRoom,
    'JOIN': join,
    'ATTACK': attack,
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
        console.log('close1', code);
    })

    ws.on('error', function (e: any) {
        console.log('wsee', e);
    })
});

wss.on("error", (e: any) => {
    console.error('err1', e);
})

function updateAttacks(attacks1: number[], i: number, attacks2: number[], j: number) {
    if (attacks1[i] === attacks2[j]) {
        attacks1[i] = 0;
        attacks2[j] = 0;
    } else if (attacks1[i] === 3 && attacks2[j] === 1) {
        attacks1[i] = 0;
    } else if (attacks1[i] === 1 && attacks2[j] === 3) {
        attacks2[j] = 0;
    } else if (attacks1[i] > attacks2[j]) {
        attacks2[j] = 0;
    } else {
        attacks1[i] = 0;
    }

    if (attacks1[i] === 0) {
        while (mid >= 0 && attacks1[mid] === 0) mid--;
    }
}

const length = 21;
let attacks1 = new Array(length).fill(0);
let attacks2 = new Array(length).fill(0);
let attack1Type = 0;
let attack2Type = 0;

const TIME = 40;
let timer = TIME;
let mid = -1;

function start(roomInfo: RoomInfo) {
    const ws1 = roomInfo.player1.ws;
    if (!roomInfo.player2) {
        throw new Error('No player2!');
    }
    const ws2 = roomInfo.player2.ws;
    const interval = setInterval(update, 500);

    function update() {
        if (!roomInfo.player2) {
            throw new Error('No player2!');
        }

        const current1 = attacks1.pop();
        attacks1.unshift(attack1Type);
        const current2 = attacks2.shift();
        attacks2.push(attack2Type);

        if (current1) {
            roomInfo.player2.blood--;
        }
        if (current2) {
            roomInfo.player1.blood--;
        }

        function end() {
            if (!roomInfo.player2) {
                throw new Error('No player2');
            }
            if (roomInfo.player1.blood === roomInfo.player2.blood) {
                broadcast(roomInfo, ResponseType.Message, { message: 'draw' });
            } else if (roomInfo.player1.blood > roomInfo.player2.blood) {
                broadcast(roomInfo, ResponseType.Message, { message: `${roomInfo.player1.name} win` });
            } else {
                broadcast(roomInfo, ResponseType.Message, { message: `${roomInfo.player2.name} win` });
            }
            broadcast(roomInfo, ResponseType.Message, { message: 'end' })
            clearInterval(interval);
            timer = TIME;
        }

        if (roomInfo.player1.blood === 0 || roomInfo.player2.blood === 0) {
            end();
            return;
        }

        if (mid >= length - 1) {
            while (mid >= 0 && attacks1[mid] === 0) mid--;
        } else if (mid >= 0) {
            mid++;
        } else if (attack1Type > 0) {
            mid = 0;
        } else {
            mid = -1;
        }
        attack1Type = 0;
        attack2Type = 0;

        if (mid >= 0) {
            if (mid > 0 && attacks2[mid - 1] !== 0) {
                updateAttacks(attacks1, mid, attacks2, mid - 1);
            }
            if (attacks2[mid] > 0) {
                updateAttacks(attacks1, mid, attacks2, mid);
            }
        }

        broadcast(roomInfo, ResponseType.GameProgress, { attacks1, attacks2 });

        if (timer <= 0) {
            end();
            return;
        }
        timer--;
    }
}
