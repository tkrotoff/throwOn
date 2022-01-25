import { format } from 'util';

type Options = {
  /**
   * Messages to ignore (won't throw), each message to ignore can be a substring or a regex.
   *
   * Empty list by default.
   */
  ignore?: (string | RegExp)[];

  /**
   * Displays the full stack trace including the 'throwError()' part if true; this helps for debugging.
   *
   * False by default.
   */
  fullStackTrace?: boolean;
};

type ConsoleMethod = typeof console['assert' | 'error' | 'warn'];

function throwError(message: string, overriddenConsoleMethod: ConsoleMethod, options: Options) {
  const fullStackTrace = options.fullStackTrace ?? false;

  // React adds its own stack trace to the console.error() message:
  // https://github.com/facebook/react/blob/v17.0.2/packages/shared/consoleWithStackDev.js#L33-L37
  //
  // Problem: when replacing console.error with throw, the "code snippet" generated by Jest (?)
  // uses this stack trace instead of the real one
  // By adding '.' at the end of each line of the "React stack trace" it forces Jest to ignore these lines
  const msg = message.replaceAll(
    // Example:
    // '    at Child (/src/utils/throwOnConsole.test.tsx:127:20)\n'
    // '    at Parent (/src/utils/throwOnConsole.test.tsx:133:26)'
    / {4}at .* \(.*:\d+:\d+\)/g,
    match => `${match}.`
  );

  const e = new Error(msg);

  Error.captureStackTrace(
    e,
    // https://nodejs.org/docs/latest-v16.x/api/errors.html#errorcapturestacktracetargetobject-constructoropt
    //
    // > The optional constructorOpt argument accepts a function.
    // > If given, all frames above constructorOpt, including constructorOpt, will be omitted from the generated stack trace.
    fullStackTrace ? undefined : overriddenConsoleMethod
  );

  throw e;
}

// Some code is duplicated between throwOnConsoleError() and throwOnConsoleWarn()
// because we want to limit the impact on the stack trace displayed by Jest when using the `ignore` option:
// one more line instead of two is better.
// https://github.com/facebook/jest/blob/v27.4.7/packages/jest-console/src/BufferedConsole.ts#L39-L63
function formatMessage(options: Options, ...data: any[]) {
  const ignore = options.ignore ?? [];
  const message = format(...data);

  return {
    shouldNotThrow: ignore.some(msgToIgnore =>
      typeof msgToIgnore === 'string' ? message.includes(msgToIgnore) : message.match(msgToIgnore)
    ),
    message
  };
}

const originalConsoleAssert = console.assert;

/**
 * Makes console.assert to throw if called.
 */
export function throwOnConsoleAssert(options: Options = {}) {
  console.assert = (condition?: boolean, ...data: any[]) => {
    if (!condition) {
      const { shouldNotThrow, message } = formatMessage(options, ...data);
      if (!shouldNotThrow) {
        throwError(message, console.assert, options);
      }
    }
  };
}

/**
 * Restores the original console.assert implementation.
 */
export function restoreConsoleAssert() {
  console.assert = originalConsoleAssert;
}

const originalConsoleError = console.error;

/**
 * Makes console.error to throw if called.
 */
export function throwOnConsoleError(options: Options = {}) {
  console.error = (...data: any[]) => {
    const { shouldNotThrow, message } = formatMessage(options, ...data);
    if (shouldNotThrow) {
      originalConsoleError(message);
    } else {
      throwError(message, console.error, options);
    }
  };
}

/**
 * Restores the original console.error implementation.
 */
export function restoreConsoleError() {
  console.error = originalConsoleError;
}

const originalConsoleWarn = console.warn;

/**
 * Makes console.warn to throw if called.
 */
export function throwOnConsoleWarn(options: Options = {}) {
  console.warn = (...data: any[]) => {
    const { shouldNotThrow, message } = formatMessage(options, ...data);
    if (shouldNotThrow) {
      originalConsoleWarn(message);
    } else {
      throwError(message, console.warn, options);
    }
  };
}

/**
 * Restores the original console.error implementation.
 */
export function restoreConsoleWarn() {
  console.warn = originalConsoleWarn;
}
