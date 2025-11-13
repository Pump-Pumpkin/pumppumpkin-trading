import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

interface WalletButtonProps {
    onConnect: (publicKey: string) => void;
}

export default function WalletButton({ onConnect }: WalletButtonProps) {
    const { publicKey, connected } = useWallet();
    const { setVisible } = useWalletModal();

    React.useEffect(() => {
        if (connected && publicKey) {
            onConnect(publicKey.toString());
        }
    }, [connected, publicKey, onConnect]);

    const handleClick = () => {
        setVisible(true);
    };

    return (
        <div className="flex justify-center px-4">
            <button
                onClick={handleClick}
                className="w-full max-w-[280px] py-4 px-6 bg-blue-600 hover:bg-blue-700 text-black border-0 rounded-xl text-base font-medium min-h-[56px] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] cursor-pointer touch-manipulation"
                style={{ backgroundColor: '#1e7cfa' }}
                onMouseEnter={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#1a6ce8';
                }}
                onMouseLeave={(e) => {
                    (e.target as HTMLElement).style.backgroundColor = '#1e7cfa';
                }}
            >
                Select Wallet
            </button>
        </div>
    );
}