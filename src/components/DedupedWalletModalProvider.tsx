import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  WalletIcon,
  WalletModalContext,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface WalletModalProps {
  className?: string;
  container?: string;
}

const DedupedWalletModal: FC<WalletModalProps> = ({
  className = "",
  container = "body",
}) => {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const { wallets, select } = useWallet();
  const { setVisible } = useWalletModal();

  const [expanded, setExpanded] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [portal, setPortal] = useState<Element | null>(null);

  const uniqueWallets = useMemo(() => {
    const seen = new Set<string>();
    return wallets.filter((wallet) => {
      const name = wallet.adapter.name ?? "Unknown Wallet";
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
  }, [wallets]);

  const [installedWallets, otherWallets] = useMemo(() => {
    const installed: typeof uniqueWallets = [];
    const others: typeof uniqueWallets = [];

    uniqueWallets.forEach((wallet) => {
      if (wallet.readyState === WalletReadyState.Installed) {
        installed.push(wallet);
      } else {
        others.push(wallet);
      }
    });

    return installed.length > 0 ? [installed, others] : [uniqueWallets, []];
  }, [uniqueWallets]);

  const hideModal = useCallback(() => {
    setFadeIn(false);
    setTimeout(() => setVisible(false), 150);
  }, [setVisible]);

  const handleClose = useCallback(
    (event?: React.MouseEvent | MouseEvent) => {
      if (event) {
        event.preventDefault();
      }
      hideModal();
    },
    [hideModal]
  );

  const handleWalletClick = useCallback(
    (walletName: string) => {
      select(walletName);
      hideModal();
    },
    [hideModal, select]
  );

  const handleTabKey = useCallback((event: KeyboardEvent) => {
    const node = nodeRef.current;
    if (!node) return;

    const focusable = node.querySelectorAll<HTMLButtonElement>("button");
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!first || !last) return;

    if (event.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }
  }, []);

  useLayoutEffect(() => {
    const element = document.querySelector(container);
    setPortal(element);
  }, [container]);

  useLayoutEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose(event as unknown as React.MouseEvent);
      } else if (event.key === "Tab") {
        handleTabKey(event);
      }
    };

    const { overflow } = window.getComputedStyle(document.body);
    setTimeout(() => setFadeIn(true), 0);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown, false);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", handleKeyDown, false);
    };
  }, [handleClose, handleTabKey]);

  useEffect(() => {
    if (fadeIn) {
      nodeRef.current?.focus();
    }
  }, [fadeIn]);

  if (!portal) {
    return null;
  }

  const renderWalletButton = (wallet: (typeof uniqueWallets)[number]) => {
    const isDetected = wallet.readyState === WalletReadyState.Installed;
    return (
      <li key={wallet.adapter.name}>
        <button
          type="button"
          onClick={() => handleWalletClick(wallet.adapter.name)}
          className="wallet-adapter-button wallet-adapter-modal-list-item"
        >
          <i className="wallet-adapter-button-start-icon">
            <WalletIcon wallet={wallet} />
          </i>
          <span className="wallet-adapter-modal-list-item-name">
            {wallet.adapter.name}
          </span>
          {isDetected ? (
            <span className="wallet-adapter-modal-list-item-badge">Detected</span>
          ) : null}
        </button>
      </li>
    );
  };

  const hasInstalledWallets = installedWallets.length > 0;
  const walletsToRender = hasInstalledWallets
    ? installedWallets
    : uniqueWallets;
  const collapsedWallets = hasInstalledWallets ? otherWallets : [];

  return createPortal(
    <div
      ref={nodeRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-adapter-modal-title"
      className={`wallet-adapter-modal ${fadeIn ? "wallet-adapter-modal-fade-in" : ""} ${className}`}
    >
      <div className="wallet-adapter-modal-container">
        <div className="wallet-adapter-modal-wrapper">
          <button
            onClick={() => handleClose()}
            className="wallet-adapter-modal-button-close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M14 12.461 8.3 6.772l5.234-5.233L12.006 0 6.772 5.234 1.54 0 0 1.539l5.234 5.233L0 12.006l1.539 1.528L6.772 8.3l5.69 5.7L14 12.461z" />
            </svg>
          </button>

          <h1 className="wallet-adapter-modal-title">
            Connect a wallet on Solana to continue
          </h1>

          <ul className="wallet-adapter-modal-list">
            {walletsToRender.map(renderWalletButton)}
            {collapsedWallets.length > 0 && (
              <>
                {expanded &&
                  collapsedWallets.map(renderWalletButton)}
              </>
            )}
          </ul>

          {collapsedWallets.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="wallet-adapter-modal-list-more"
            >
              <span>{expanded ? "Less options" : "More options"}</span>
              <svg
                width="13"
                height="7"
                viewBox="0 0 13 7"
                xmlns="http://www.w3.org/2000/svg"
                className={expanded ? "wallet-adapter-modal-list-more-icon-rotate" : ""}
              >
                <path d="M0.71418 1.626L5.83323 6.26188C5.91574 6.33657 6.0181 6.39652 6.13327 6.43762C6.24844 6.47872 6.37371 6.5 6.50048 6.5C6.62725 6.5 6.75252 6.47872 6.8677 6.43762C6.98287 6.39652 7.08523 6.33657 7.16774 6.26188L12.2868 1.626C12.7753 1.1835 12.3703 0.5 11.6195 0.5H1.37997C0.629216 0.5 0.224175 1.1835 0.71418 1.626Z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        className="wallet-adapter-modal-overlay"
        onMouseDown={(event) => {
          event.preventDefault();
          handleClose();
        }}
      />
    </div>,
    portal
  );
};

interface ProviderProps extends WalletModalProps {
  children: ReactNode;
}

export const DedupedWalletModalProvider: FC<ProviderProps> = ({
  children,
  ...modalProps
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <WalletModalContext.Provider value={{ visible, setVisible }}>
      {children}
      {visible ? <DedupedWalletModal {...modalProps} /> : null}
    </WalletModalContext.Provider>
  );
};

