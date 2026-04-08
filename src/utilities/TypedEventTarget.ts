type TypedEventListener<TEvent extends Event> = (event: TEvent) => void;

interface TypedEventListenerObject<TEvent extends Event> {
  handleEvent: (event: TEvent) => void;
}

type TypedEventListenerOrEventListenerObject<TEvent extends Event> =
  | TypedEventListener<TEvent>
  | TypedEventListenerObject<TEvent>;

// Ensures the event map is an object, but without requiring it to have an index
// signature like `Record<string, Event>` would.
type TypedEventMap<T> = {
  [K in keyof T]: T[K];
};

export interface TypedEventTarget<TEventMap extends TypedEventMap<TEventMap>> {
  addEventListener: <T extends keyof TEventMap & string>(
    type: T,
    callback: TypedEventListenerOrEventListenerObject<TEventMap[T]> | null,
    options?: AddEventListenerOptions | boolean,
  ) => void;

  removeEventListener: <T extends keyof TEventMap & string>(
    type: T,
    callback: TypedEventListenerOrEventListenerObject<TEventMap[T]> | null,
    options?: EventListenerOptions | boolean,
  ) => void;

  /** @deprecated Use `dispatchTypedEvent` for better type safety */
  dispatchEvent: (event: Event) => boolean;
}

export class TypedEventTarget<
  TEventMap extends TypedEventMap<TEventMap>,
> extends EventTarget {
  dispatchTypedEvent<T extends keyof TEventMap>(_type: T, event: TEventMap[T]) {
    return super.dispatchEvent(event);
  }
}
