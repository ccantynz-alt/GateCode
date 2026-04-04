// GateCode — SSE notification manager

export class SSEManager {
  private clients: Map<number, WritableStreamDefaultWriter[]> = new Map();

  /**
   * Register a new SSE client for a user.
   * Returns a ReadableStream to pipe into the HTTP response.
   */
  addClient(userId: number): ReadableStream {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const writers = this.clients.get(userId) ?? [];
    writers.push(writer);
    this.clients.set(userId, writers);

    return readable;
  }

  /**
   * Remove a specific client writer for a user.
   */
  removeClient(userId: number, stream: WritableStreamDefaultWriter): void {
    const writers = this.clients.get(userId);
    if (!writers) return;

    const idx = writers.indexOf(stream);
    if (idx !== -1) {
      writers.splice(idx, 1);
    }
    if (writers.length === 0) {
      this.clients.delete(userId);
    }
  }

  /**
   * Send an SSE-formatted message to every connected client for a user.
   */
  notify(userId: number, event: string, data: any): void {
    const writers = this.clients.get(userId);
    if (!writers || writers.length === 0) return;

    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const encoded = new TextEncoder().encode(message);

    for (const writer of writers) {
      writer.write(encoded).catch(() => {
        // Client disconnected — clean up on next interaction
        this.removeClient(userId, writer);
      });
    }
  }
}

/** Singleton instance shared across all routes */
export const sseManager = new SSEManager();
