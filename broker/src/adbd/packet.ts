export const PacketCommand = {
  "A_SYNC": 0x434e5953, 
  "A_CNXN": 0x4e584e43,
  "A_OPEN": 0x4e45504f,
  "A_OKAY": 0x59414b4f,
  "A_CLSE": 0x45534c43,
  "A_WRTE": 0x45545257,
  "A_AUTH": 0x48545541
};

export const AuthPacketType = {
  "TOKEN": 1,
  "SIGNATURE": 2,
  "RSAPUBLICKEY": 3
};

/** 
 * Adb Packet Format
 * struct message {
 *  unsigned command;       command identifier constant     
 *  unsigned arg0;          first argument                  
 *  unsigned arg1;          second argument                 
 *  unsigned data_length;   length of payload (0 is allowed)
 *  unsigned data_crc32;    crc32 of data payload           
 *  unsigned magic;         command ^ 0xffffffff            
 *  };
 */
export class Packet {
  readonly command: number;
  readonly arg0: number;
  readonly arg1: number;
  readonly length: number;
  readonly checksum: number;
  readonly magic: number;
  public data: Buffer;

  constructor(command: number, arg0: number, arg1: number, length: number, check: number, magic: number, data: Buffer) {
    this.command = command;
    this.arg0 = arg0;
    this.arg1 = arg1;
    this.length = length;
    this.checksum = check;
    this.magic = magic;
    this.data = data;
  }

  static fromBuffer(buffer: Buffer): Packet {
    return new Packet(
      buffer.readUInt32LE(0),
      buffer.readUInt32LE(4),
      buffer.readUInt32LE(8),
      buffer.readUInt32LE(12),
      buffer.readUInt32LE(16),
      buffer.readUInt32LE(20),
      new Buffer(0)
    );
  }

  static genSendPacket(command: number, arg0: number, arg1: number, data: Buffer): Packet {
    if(!data) {
      return new Packet(command, arg0, arg1, 0, 0, getMagic(command), new Buffer(0));
    } else {
      return new Packet(command, arg0, arg1, data.length, getChecksum(data), getMagic(command), data);
    }
  }

  public toBuffer() {
    const buffer = new Buffer(24 + this.length);
    buffer.writeUInt32LE(this.command, 0);
    buffer.writeUInt32LE(this.arg0, 4);
    buffer.writeUInt32LE(this.arg1, 8);
    buffer.writeUInt32LE(this.length, 12);
    buffer.writeUInt32LE(this.checksum, 16);
    buffer.writeUInt32LE(this.magic, 20);
    this.data.copy(buffer, 24);
    return buffer;
  }

  public verifyChecksum() {
    return this.checksum === getChecksum(this.data);
  }

  public verifyMagic() {
    return this.magic === getMagic(this.command);
  }

  public toString(): string {
    let commandStr = "unknown";
    switch(this.command) {
      case PacketCommand.A_AUTH:
        commandStr = "AUTH"; break;
      case PacketCommand.A_CLSE:
        commandStr = "CLSE"; break;
      case PacketCommand.A_CNXN:
        commandStr = "CNXN"; break;
      case PacketCommand.A_OKAY:
        commandStr = "OKAY"; break;
      case PacketCommand.A_OPEN:
        commandStr = "OPEN"; break;
      case PacketCommand.A_SYNC:
        commandStr = "SYNC"; break;
      case PacketCommand.A_WRTE:
        commandStr = "WRTE"; break;
    }  
    return `{ \n\t${commandStr} \n\targ0: ${this.arg0} \n\targ1: ${this.arg1} \n\tdataLen: ${this.data.length} \n}`;
  }
}

export const getChecksum = (data: Buffer): number => {
  if (data && data.length > 0) {
    return data.reduce((preV, curV) => curV + preV, 0);
  } else {
    return 0;
  }
};

export const getMagic = (data: number): number => {
  return (data ^ 0xffffffff) >>> 0; 
};

export const getSwap32 = (val: number): number => {
  const buffer = new Buffer(4);
  buffer.writeUInt32LE(val, 0);
  return buffer.readUInt32BE(0);
};