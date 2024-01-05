import http from "http";
import https from "https";
import { URL } from "url";

interface HttpProxyAgentOptions extends http.AgentOptions {
  proxy: string | URL;
  proxyRequestOptions?: ProxyAgentRequestOptions;
}

interface HttpsProxyAgentOptions extends https.AgentOptions {
  proxy: string | URL;
  proxyRequestOptions?: ProxyAgentRequestOptions;
}

interface ProxyAgentRequestOptions {
  ca?: string[];
  headers?: http.OutgoingHttpHeaders;
  rejectUnauthorized?: boolean;
}

// HTTP and HTTPS proxy agent copied from hpagent repositry, but also compatible with node6
export class HttpProxyAgent extends http.Agent {
  proxy: URL;
  keepAlive?: boolean;
  proxyRequestOptions?: ProxyAgentRequestOptions;

  constructor(options: HttpProxyAgentOptions) {
    super(getAgentOptions(options));
    this.proxy = typeof options.proxy === "string" ? new URL(options.proxy) : options.proxy;
    this.proxyRequestOptions = options.proxyRequestOptions || {};
  }

  createConnection(options: http.RequestOptions, callback) {
    const requestOptions: https.RequestOptions = Object.assign({}, this.proxyRequestOptions, {
      method: "CONNECT",
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      agent: false,
      timeout: options.timeout || 0,
      headers: Object.assign({}, this.proxyRequestOptions.headers, {
        connection: this.keepAlive ? "keep-alive" : "close",
        host: `${options.host}:${options.port}`,
      }),
    });

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(
        `${decodeURIComponent(this.proxy.username || "")}:${decodeURIComponent(
          this.proxy.password || "",
        )}`,
      ).toString("base64");
      requestOptions.headers["proxy-authorization"] = `Basic ${base64}`;
    }

    if (this.proxy.protocol === "https:") {
      requestOptions.servername = this.proxy.hostname;
    }

    const request = (this.proxy.protocol === "http:" ? http : https).request(requestOptions);
    request.once("connect", (response, socket) => {
      request.removeAllListeners();
      socket.removeAllListeners();
      if (response.statusCode === 200) {
        callback(null, socket);
      } else {
        socket.destroy();
        callback(new Error(`Bad response: ${response.statusCode}`), null);
      }
    });

    request.once("timeout", () => {
      request.destroy(new Error("Proxy timeout"));
    });

    request.once("error", (err) => {
      request.removeAllListeners();
      callback(err, null);
    });

    request.end();
  }
}

export class HttpsProxyAgent extends https.Agent {
  proxy: URL;
  keepAlive?: boolean;
  proxyRequestOptions?: ProxyAgentRequestOptions;

  constructor(options: HttpsProxyAgentOptions) {
    super(getAgentOptions<HttpsProxyAgentOptions>(options));
    this.proxy = typeof options.proxy === "string" ? new URL(options.proxy) : options.proxy;
    this.proxyRequestOptions = options.proxyRequestOptions || {};
  }

  createConnection(options: https.RequestOptions, callback) {
    const requestOptions: https.RequestOptions = Object.assign({}, this.proxyRequestOptions, {
      method: "CONNECT",
      host: this.proxy.hostname,
      port: this.proxy.port,
      path: `${options.host}:${options.port}`,
      setHost: false,
      agent: false,
      timeout: options.timeout || 0,
      headers: Object.assign({}, this.proxyRequestOptions.headers, {
        connection: this.keepAlive ? "keep-alive" : "close",
        host: `${options.host}:${options.port}`,
      }),
    });

    if (this.proxy.username || this.proxy.password) {
      const base64 = Buffer.from(
        `${decodeURIComponent(this.proxy.username || "")}:${decodeURIComponent(
          this.proxy.password || "",
        )}`,
      ).toString("base64");
      requestOptions.headers["proxy-authorization"] = `Basic ${base64}`;
    }

    // Necessary for the TLS check with the proxy to succeed.
    if (this.proxy.protocol === "https:") {
      requestOptions.servername = this.proxy.hostname;
    }

    const request = (this.proxy.protocol === "http:" ? http : https).request(requestOptions);
    request.once("connect", (response, socket) => {
      request.removeAllListeners();
      socket.removeAllListeners();
      if (response.statusCode === 200) {
        //@ts-ignore
        const secureSocket = super.createConnection({ ...options, socket });
        callback(null, secureSocket);
      } else {
        socket.destroy();
        callback(new Error(`Bad response: ${response.statusCode}`), null);
      }
    });

    request.once("timeout", () => {
      request.destroy(new Error("Proxy timeout"));
    });

    request.once("error", (err) => {
      request.removeAllListeners();
      callback(err, null);
    });

    request.end();
  }
}

type AgentOptions<T> = T extends HttpProxyAgentOptions ? http.AgentOptions : https.AgentOptions;
function getAgentOptions<T extends HttpProxyAgentOptions>(options: T): AgentOptions<T> {
  return Object.keys(options).reduce((acc, key) => {
    if (key !== "proxy" && key !== "proxyRequestOptions") {
      acc[key] = options[key];
    }
    return acc;
  }, {});
}
