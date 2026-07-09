export class Readable {}
export class Writable {}
export class Duplex extends Readable {}
export class Transform extends Duplex {}
export class PassThrough extends Transform {}

const streamShim = {
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
};

export default streamShim;
