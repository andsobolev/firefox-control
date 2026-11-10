"use strict";
function validateConnection(value) {
  if (!value || typeof value!=="object" || value.schema!==1 ||
      typeof value.url!=="string" || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(value.url) ||
      Number(value.url.split(":").pop())>65535 ||
      typeof value.token!=="string" || !/^[a-f0-9]{64}$/.test(value.token))
    throw new Error("Choose the connection JSON created by install.ps1 on this computer.");
  return {schema:1,url:value.url,token:value.token};
}
