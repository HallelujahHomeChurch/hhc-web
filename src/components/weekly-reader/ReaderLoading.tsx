import {useEffect, useState} from 'react';
import {Home, LoaderCircle, X} from 'lucide-react';

export function ReaderLoading({label, overlay = false, showHeader = false}: {label: string; overlay?: boolean; showHeader?: boolean}) {
  const [showIcon, setShowIcon] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowIcon(true), 250);
    return () => clearTimeout(timer);
  }, []);
  const indicator = <div>{showIcon ? <LoaderCircle className="reader-loading-icon" size={28} aria-hidden="true"/> : <span className="reader-loading-icon-placeholder" aria-hidden="true"/>}
      <p role="status">{label}</p>
    </div>;
  if (showHeader) return <div className="reader-loading-shell" data-overlay={overlay || undefined} aria-busy="true">
    <header className="reader-tabbar" aria-hidden="true">
      <span className="reader-loading-home"><Home size={21}/></span>
      <div className="reader-tabs"><div className="reader-tab" data-active><span className="reader-loading-tab">{label}</span><X size={16}/></div></div>
    </header>
    <div className="reader-loading" aria-busy="true">{indicator}</div>
  </div>;
  return <div className="reader-loading" data-overlay={overlay || undefined} aria-busy="true">{indicator}</div>;
}
