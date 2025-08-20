/**
 * Result pattern for handling success/error cases without exceptions
 */
export abstract class Result<T, E> {
  abstract isSuccess(): this is Success<T, E>;
  abstract isFailure(): this is Failure<T, E>;
  
  abstract map<U>(fn: (value: T) => U): Result<U, E>;
  abstract mapError<F>(fn: (error: E) => F): Result<T, F>;
  abstract flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  
  get value(): T {
    if (this.isFailure()) {
      throw new Error('Cannot get value from failure result');
    }
    return (this as unknown as Success<T, E>).data;
  }
  
  get error(): E {
    if (this.isSuccess()) {
      throw new Error('Cannot get error from success result');
    }
    return (this as unknown as Failure<T, E>).errorData;
  }
}

export class Success<T, E> extends Result<T, E> {
  constructor(public readonly data: T) {
    super();
  }
  
  isSuccess(): this is Success<T, E> {
    return true;
  }
  
  isFailure(): this is Failure<T, E> {
    return false;
  }
  
  map<U>(fn: (value: T) => U): Result<U, E> {
    return new Success(fn(this.data));
  }
  
  mapError<F>(_fn: (error: E) => F): Result<T, F> {
    return new Success(this.data);
  }
  
  flatMap<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.data);
  }
}

export class Failure<T, E> extends Result<T, E> {
  constructor(public readonly errorData: E) {
    super();
  }
  
  isSuccess(): this is Success<T, E> {
    return false;
  }
  
  isFailure(): this is Failure<T, E> {
    return true;
  }
  
  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new Failure(this.errorData);
  }
  
  mapError<F>(fn: (error: E) => F): Result<T, F> {
    return new Failure(fn(this.errorData));
  }
  
  flatMap<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new Failure(this.errorData);
  }
}

// Helper functions for creating results
export const success = <T, E = never>(data: T): Result<T, E> => new Success(data);
export const failure = <T = never, E = unknown>(error: E): Result<T, E> => new Failure(error);

// Async result helpers
export const asyncResult = async <T, E>(
  fn: () => Promise<T>
): Promise<Result<T, E>> => {
  try {
    const result = await fn();
    return success(result);
  } catch (error) {
    return failure(error as E);
  }
};