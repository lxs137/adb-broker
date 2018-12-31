import { Transform, TransformOptions, TransformCallback } from "stream";
const logger = require("log4js").getLogger("commandReply");

const MinDataEmitTimer = 500;

/** 
 * Input stream, output packets 
 */
export class CommandReplyStream extends Transform {
  private buffer: CommandReplyBuffer;
  private isEmpty: boolean = true;
  private forceEmitIntervalID: NodeJS.Timer;
  
  constructor(packetLen: number, streamOpt?: TransformOptions) {
    super({
      writableObjectMode: true,
      readableObjectMode: true,
      ...streamOpt
    });
    this.buffer = new CommandReplyBuffer(packetLen);
  }

  _transform(chunk: any, encoding: string, callback: TransformCallback) {
    if(!Buffer.isBuffer(chunk))
      chunk = new Buffer(chunk, encoding);
    this.buffer.addData(chunk);
    if (this.isEmpty) {
      this.isEmpty = false;
      this.emit("hasData");
      this.forceEmitIntervalID = setInterval(() => {
        this.forceFlush();
      }, MinDataEmitTimer);
    }
    let packet;
    while(packet = this.buffer.getPacket()) {
      this.emitData(packet);
    }
    callback();
  }

  public forceFlush() {
    this.emitData(this.getRemainData());
  }

  public getRemainData(): Buffer {
    return this.buffer.getRemainData();
  }

  private emitData(data: Buffer) {
    if(data && data.length >= 1) {
      this.push(data);
      if(this.forceEmitIntervalID)
        clearInterval(this.forceEmitIntervalID);
      this.forceEmitIntervalID = setInterval(() => {
        this.forceFlush();
      }, MinDataEmitTimer);
    }
  }
}

export class CommandReplyBuffer {
  private cache: Buffer;
  private packetLen: number;
  private packets: Buffer[];

  constructor(lenPerPacket: number) {
    this.packetLen = lenPerPacket;
    this.cache = new Buffer(0);
    this.packets = [];
  }

  public addData(buf: Buffer) {
    if(!buf || buf.length <= 0)
      return;
    const mergeLen = this.cache.length + buf.length;
    this.cache = Buffer.concat([this.cache, buf], mergeLen);
    if(mergeLen >= this.packetLen)
      this.cutToPacket();
  }

  public getPacket(): Buffer {
    if(this.packets.length >= 1)
      return this.packets.pop();
    else
      return undefined;
  }

  public getRemainData(): Buffer {
    const data = this.cache;
    this.cache = this.cache.slice(this.cache.length);
    return data;
  }

  private cutToPacket() {
    const packetCount = Math.floor(this.cache.length / this.packetLen);
    for(let i = 0; i < packetCount; i++) {
      const packet = new Buffer(this.packetLen);
      this.cache.copy(packet, 0, i * this.packetLen, (i + 1) * this.packetLen);
      this.packets.push(packet);
    }
    this.cache = this.cache.slice(packetCount * this.packetLen);
  }
}