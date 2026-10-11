import {useEffect, useState} from 'react';
import {LoaderCircle} from 'lucide-react';

export function ReaderLoading({label, overlay = false}: {label: string; overlay?: boolean}) {
  const [showIcon, setShowIcon] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 250);
    return () => clearTimeout(timer);
  }, []);
  return <div className="reader-loading" data-overlay={overlay || undefined} aria-busy="true">
    <div>{showIcon ? <LoaderCircle className="reader-loading-icon" size={28} aria-hidden="true"/> : <span className="reader-loading-icon-placeholder" aria-hidden="true"/>}
      <p role="status">{label}</p>
    </div>
  </div>;
}
