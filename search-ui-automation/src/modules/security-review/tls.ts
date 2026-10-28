import tls from 'tls';
import type { TlsInfo } from './types';

export async function inspectTls(baseURL: string): Promise<TlsInfo> {
  const { hostname, port } = new URL(baseURL);
  const targetPort = port ? Number(port) : 443;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: targetPort,
        servername: hostname,
        timeout: 10_000,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const validFrom = cert.valid_from || null;
        const validTo = cert.valid_to || null;
        const info: TlsInfo = {
          hostname,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError
            ? String(socket.authorizationError)
            : null,
          protocol: socket.getProtocol(),
          subject: formatName(cert.subject),
          issuer: formatName(cert.issuer),
          validFrom,
          validTo,
          daysRemaining: daysUntil(validTo),
        };
        socket.end();
        resolve(info);
      },
    );

    socket.on('error', (error) => {
      resolve({
        hostname,
        authorized: false,
        authorizationError: error.message,
        protocol: null,
        subject: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
      });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({
        hostname,
        authorized: false,
        authorizationError: 'TLS handshake timed out',
        protocol: null,
        subject: null,
        issuer: null,
        validFrom: null,
        validTo: null,
        daysRemaining: null,
      });
    });
  });
}

function formatName(value: tls.PeerCertificate['subject'] | undefined): string | null {
  if (!value) return null;
  return Object.entries(value)
    .map(([key, item]) => `${key}=${item}`)
    .join(', ');
}

function daysUntil(dateText: string | null): number | null {
  if (!dateText) return null;
  const ms = Date.parse(dateText);
  if (Number.isNaN(ms)) return null;
  return Math.floor((ms - Date.now()) / 86_400_000);
}
