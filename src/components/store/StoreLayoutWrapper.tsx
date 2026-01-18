'use client';

import React from 'react';
const StoreLayoutWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <div className="min-h-screen bg-garabandal-mist selection:bg-garabandal-gold selection:text-white">
            <main>
                {children}
            </main>
        </div>
    );
};

export default StoreLayoutWrapper;
