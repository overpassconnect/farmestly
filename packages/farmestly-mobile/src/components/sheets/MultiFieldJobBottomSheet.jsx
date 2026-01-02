import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import config from '../../globals/config';
import { useUnits } from '../../providers/UnitsProvider';
import { useGlobalContext } from '../context/GlobalContextProvider';
import ListItem from '../ui/list/ListItem';
import EmptyState from '../ui/core/EmptyState';
import SearchableListSheet from '../ui/list/SearchableListSheet';

/**
 * MultiFieldJobBottomSheet
 *
 * Bottom sheet that appears when user wants to start a batch job on multiple fields.
 * Only shows job types that support multi-field operations (Spray, Irrigate).
 * Excludes Sow and Harvest which require per-field crop/cultivation configuration.
 * Uses SearchableListSheet for searchable template selection.
 */
const MultiFieldJobBottomSheet = ({ fields, onSelectJob, onClose }) => {
	const { t } = useTranslation(['common', 'screens']);
	const { format } = useUnits();
	const navigation = useNavigation();
	const { farmData } = useGlobalContext();
	const totalArea = fields.reduce((sum, f) => sum + (f.area || 0), 0);

	// Combine all templates (spray and irrigate) with type info for display
	const allTemplates = useMemo(() => {
		const templates = [];

		(farmData?.jobTemplates || []).forEach(template => {
			if (template.type === 'spray' || template.type === 'irrigate') {
				templates.push({
					...template,
					_searchSubtitle: getTemplateSubtitle(template, farmData),
					_typeLabel: template.type === 'spray'
						? t('common:jobTypes.spray')
						: t('common:jobTypes.irrigate')
				});
			}
		});

		return templates;
	}, [farmData?.jobTemplates, farmData, t]);

	// Get template subtitle
	function getTemplateSubtitle(template, farmData) {
		const parts = [];

		if (template.machine) {
			const machine = farmData?.machines?.find(m => m._id === template.machine);
			if (machine) parts.push(machine.name);
		}

		if (template.attachment) {
			const attachment = farmData?.attachments?.find(a => a._id === template.attachment);
			if (attachment) parts.push(attachment.name);
		}

		if (template.tool) {
			const tool = farmData?.tools?.find(t => t._id === template.tool);
			if (tool) parts.push(tool.name);
		}

		return parts.length > 0 ? parts.join(' • ') : '';
	}

	// Handle template selection
	const handleSelectTemplate = (template) => {
		onSelectJob(template.type, fields, template.id || template._id);
	};

	// Navigate to template wizard
	const handleCreateTemplate = () => {
		onClose();
		navigation.navigate('TemplateWizardScreen');
	};

	// Render template item
	const renderTemplateItem = ({ item, onSelect }) => (
		<TouchableOpacity
			style={styles.jobItem}
			onPress={() => onSelect(item)}
		>
			<ListItem
				icon={config.JOB_TYPE_ICONS[item.type]}
				title={item.name}
				subTitle1={item._typeLabel}
				subTitle2={item._searchSubtitle}
				simple={true}
				showChevron={true}
			/>
		</TouchableOpacity>
	);

	// If no templates, show empty state
	if (allTemplates.length === 0) {
		return (
			<View style={styles.emptyContainer}>
				<View style={styles.header}>
					<Text style={styles.sheetTitle}>{t('screens:multiFieldJob.selectTemplate')}</Text>
					<Text style={styles.fieldInfo}>
						{fields.length} {t('screens:multiFieldJob.fields')} • {format(totalArea, 'area')}
					</Text>
				</View>

				<EmptyState
					icon={require('../../assets/icons/job_icon.png')}
					title={t('screens:multiFieldJob.noTemplates')}
					subtitle={t('screens:multiFieldJob.noTemplatesSubtitle')}
					actionText={t('screens:multiFieldJob.createTemplate')}
					onAction={handleCreateTemplate}
				/>

				<View style={styles.footer}>
					<TouchableOpacity
						style={styles.closeButton}
						onPress={onClose}
					>
						<Text style={styles.closeButtonText}>{t('common:buttons.cancel')}</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	// Custom header with field info
	const customHeader = (
		<View style={styles.fieldInfoHeader}>
			<Text style={styles.fieldInfo}>
				{fields.length} {t('screens:multiFieldJob.fields')} • {format(totalArea, 'area')}
			</Text>
		</View>
	);

	return (
		<SearchableListSheet
			localData={allTemplates}
			searchKeys={['name', '_typeLabel', '_searchSubtitle']}
			searchPlaceholder={t('screens:multiFieldJob.searchTemplates')}
			title={t('screens:multiFieldJob.selectTemplate')}
			onSelect={handleSelectTemplate}
			renderItem={renderTemplateItem}
			keyExtractor={(item) => item._id}
			cancelLabel={t('common:buttons.cancel')}
			onCancel={onClose}
			emptyTitle={t('screens:multiFieldJob.noTemplatesFound')}
			emptySubtitle={t('screens:multiFieldJob.tryDifferentSearch')}
			customFilters={customHeader}
		/>
	);
};

const styles = StyleSheet.create({
	emptyContainer: {
		flex: 1,
		backgroundColor: 'white',
	},
	header: {
		paddingHorizontal: 16,
		paddingTop: 20,
		paddingBottom: 12,
	},
	sheetTitle: {
		fontFamily: 'Geologica-Bold',
		fontSize: 28,
		color: colors.PRIMARY,
		marginBottom: 8,
	},
	fieldInfoHeader: {
		marginBottom: 8,
	},
	fieldInfo: {
		fontFamily: 'Geologica-Regular',
		fontSize: 16,
		color: colors.PRIMARY_LIGHT,
	},
	jobItem: {
		marginBottom: 8,
	},
	footer: {
		paddingHorizontal: 16,
		paddingVertical: 16,
		borderTopWidth: 1,
		borderTopColor: colors.SECONDARY_LIGHT,
	},
	closeButton: {
		alignSelf: 'center',
		borderRadius: 50,
		borderColor: colors.PRIMARY,
		borderWidth: 2,
		paddingVertical: 10,
		paddingHorizontal: 32,
		width: '70%',
		backgroundColor: 'white',
	},
	closeButtonText: {
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY,
		fontSize: 18,
		textAlign: 'center',
	},
});

export default MultiFieldJobBottomSheet;
