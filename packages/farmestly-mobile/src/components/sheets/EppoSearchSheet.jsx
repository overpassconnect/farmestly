import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useLocale } from '../../providers/LocaleProvider';
import SearchableListSheet from '../ui/list/SearchableListSheet';
import ListItem from '../ui/list/ListItem';
import { toTitleCase, deduplicateEppoResults } from '../../utils/eppoHelpers';

/**
 * EppoSearchSheet - Wraps SearchableListSheet for manual EPPO searching.
 * Users can search by scientific name, common name, or different language.
 *
 * @param {object} props
 * @param {function} props.onSelect - Callback when an EPPO code is selected
 * @param {function} props.onCancel - Callback to close the sheet
 */
const EppoSearchSheet = ({ onSelect, onCancel }) => {
	const { t } = useTranslation('common');
	const { isOffline } = useGlobalContext();
	const { locale } = useLocale();

	const handleSelect = (item) => {
		onSelect(item);
		onCancel();
	};

	// Transform results to deduplicate by eppocode and pick best language
	const transformResults = (results) => {
		return deduplicateEppoResults(results, locale);
	};

	const renderItem = ({ item, onSelect: selectHandler }) => (
		<ListItem
			title={`${item.eppocode} • ${toTitleCase(item.fullname)}`}
			subTitle1={item.preferred}
			icon={require('../../assets/icons/eppo_brown.png')}
			onPress={() => selectHandler(item)}
			showChevron={false}
			simple={true}
		/>
	);

	return (
		<SearchableListSheet
			isBottomSheet={true}
			isOnline={!isOffline}
			endpoint="/data/eppo/search"
			responseDataKey="results"
			transformResults={transformResults}
			keyExtractor={(item) => item.eppocode}
			renderItem={renderItem}
			onSelect={handleSelect}
			onCancel={onCancel}
			title={t('titles.searchEppoCodes')}
			searchPlaceholder={t('placeholders.searchEppo')}
			cancelLabel={t('buttons.cancel')}
			emptyTitle={t('messages.noEppoResults')}
			emptySubtitle={t('messages.tryDifferentEppoSearch')}
			debounceMs={400}
		/>
	);
};

export default EppoSearchSheet;
