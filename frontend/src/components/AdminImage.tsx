import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import api, { getImageUrl } from '../lib/api';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { url?: string | null };

export default function AdminImage({ url, alt = '', ...props }: Props) {
  const [src, setSrc] = useState('/sem-imagem.svg');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    if (!url?.startsWith('/api/storage/')) {
      setSrc(getImageUrl(url));
      return () => controller.abort();
    }
    let key: string;
    try { key = decodeURIComponent(url.slice('/api/storage/'.length)); }
    catch { setSrc('/sem-imagem.svg'); return () => controller.abort(); }
    setSrc('/sem-imagem.svg');
    api.get('/upload/preview/' + encodeURIComponent(key), { responseType: 'blob', signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const blob = data as Blob;
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(blob.type)) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => { if (!controller.signal.aborted) setSrc('/sem-imagem.svg'); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return <img src={src} alt={alt} {...props} />;
}
