declare const __TAMIRAN_BUILD_ID__: string;

export const APP_VERSION = "2.0.0-php.2";
export const APP_CHANNEL = "php";
export const APP_BUILD_ID =
  typeof __TAMIRAN_BUILD_ID__ === "string"
    ? __TAMIRAN_BUILD_ID__
    : "development";
