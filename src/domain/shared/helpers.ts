import { Result, failure } from './result';

/**
 * Helper function to convert a Result<T | null, E> to Result<T, E> with null check
 */
export function requireNonNull<T, E>(
  result: Result<T | null, E>,
  errorMessage: string,
  errorCode: string = 'ENTITY_NOT_FOUND'
): Result<T, E> {
  if (result.isFailure()) {
    return failure(result.error);
  }
  
  if (result.value === null) {
    return failure({
      code: errorCode,
      message: errorMessage
    } as E);
  }
  
  return { ...result, value: result.value };
}