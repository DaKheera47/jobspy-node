export interface ProxySelection {
  index: number;
  proxyUrl: string | undefined;
}

export class ProxyPool {
  private readonly proxies: string[];
  private cursor = 0;

  public constructor(proxies?: string | string[]) {
    const normalized = Array.isArray(proxies)
      ? proxies
      : proxies
        ? [proxies]
        : [];

    this.proxies = normalized
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .map((value) => {
        if (/^[a-z]+:\/\//i.test(value)) {
          return value;
        }

        return `http://${value}`;
      });
  }

  public hasProxies(): boolean {
    return this.proxies.length > 0;
  }

  public size(): number {
    return this.proxies.length;
  }

  public next(): ProxySelection {
    if (this.proxies.length === 0) {
      return { index: -1, proxyUrl: undefined };
    }

    const index = this.cursor % this.proxies.length;
    this.cursor = (this.cursor + 1) % this.proxies.length;
    return { index, proxyUrl: this.proxies[index] };
  }
}

