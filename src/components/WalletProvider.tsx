import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import {
    SolflareWalletAdapter,
    TorusWalletAdapter,
    LedgerWalletAdapter,
} from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';
import { DedupedWalletModalProvider } from './DedupedWalletModalProvider';

interface Props {
    children: ReactNode;
}

export const WalletContextProvider: FC<Props> = ({ children }) => {
    // Use public RPC for compatibility in the browser
    const endpoint = useMemo(() => 'https://api.mainnet-beta.solana.com', []);

    const wallets = useMemo(
        () => [
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
            new LedgerWalletAdapter(),
        ],
        []
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <DedupedWalletModalProvider>
                    {children}
                </DedupedWalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};