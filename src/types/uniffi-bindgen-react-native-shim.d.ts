declare module 'uniffi-bindgen-react-native' {
  export type UniffiByteArray = Uint8Array;
  export type UniffiRustArcPtr = bigint;
  export type UnsafeMutableRawPointer = bigint;
  export type UniffiRustCallStatus = {
    code: number;
    errorBuf: Uint8Array;
  };
  export type UniffiResult<T = unknown, E = unknown> =
    | { ok: T; err?: never }
    | { ok?: never; err: E };

  export const FfiConverterObject: any;
  export const FfiConverterObjectWithCallbacks: any;
  export const RustBuffer: any;
  export const UniffiAbstractObject: any;

  export const destructorGuardSymbol: unique symbol;
  export const pointerLiteralSymbol: unique symbol;
  export const uniffiTypeNameSymbol: unique symbol;
}
