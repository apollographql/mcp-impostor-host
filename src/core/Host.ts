interface SandboxConfig {
  uri: string;
}

interface HostConfig {
  sandbox: SandboxConfig;
}

interface ConnectOptions {
  uri: string;
}

export class Host {
  private config: HostConfig;

  constructor(config: HostConfig) {
    this.config = config;
  }

  async connect(options: ConnectOptions) {}
}
