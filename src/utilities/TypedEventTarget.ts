type TypedEventListener<TEvent extends Event> = (event: TEvent) => void;

interface TypedEventListenerObject<TEvent extends Event> {
  handleEvent: (event: TEvent) => void;
}

type TypedEventListenerOrEventListenerObject<TEvent extends Event> =
  | TypedEventListener<TEvent>
  | TypedEventListenerObject<TEvent>;

export interface TypedEventTarget<TEventMap extends Record<string, Event>> {
  addEventListener: <TName extends keyof TEventMap>(
    name: TName,
    callback: TypedEventListenerOrEventListenerObject<TEventMap[TName]> | null,
    options?: AddEventListenerOptions | boolean,
  ) => void;

  removeEventListener: <TName extends keyof TEventMap>(
    name: TName,
    callback: TypedEventListenerOrEventListenerObject<TEventMap[TName]> | null,
    options?: EventListenerOptions | boolean,
  ) => void;

  /** @deprecated Use `dispatchTypedEvent` for better type safety */
  dispatchEvent: (event: Event) => boolean;
}

export class TypedEventTarget<
  TEventMap extends Record<string, Event>,
> extends EventTarget {
  dipatchTypedEvent<TName extends keyof TEventMap>(
    _name: TName,
    event: TEventMap[TName],
  ) {
    return super.dispatchEvent(event);
  }
}
