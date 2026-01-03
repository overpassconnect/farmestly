// components/UnitsWrapper.jsx
import React from 'react';
import { UnitsProvider } from '../providers/UnitsProvider';
import { useGlobalContext } from './context/GlobalContextProvider';

export const UnitsWrapper = ({ children }) => {
	const { account, updatePreferences } = useGlobalContext();

	const handleUnitChange = (category, newUnit) => {
		updatePreferences('units', {
			...account?.preferences?.units,
			[category]: newUnit
		});
	};

	return (
		<UnitsProvider
			preferences={account?.preferences?.units ?? {}}
			onPreferenceChange={handleUnitChange}
		>
			{children}
		</UnitsProvider>
	);
};