import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import colors from '../../globals/colors';
import config from '../../globals/config';
import ListItem from '../ui/list/ListItem';
import EmptyState from '../ui/core/EmptyState';
import SearchableListSheet from '../ui/list/SearchableListSheet';
import { useGlobalContext } from '../context/GlobalContextProvider';
import { useBottomSheet } from './BottomSheetContextProvider';
import SelectJobTypeBottomSheet from './SelectJobTypeBottomSheet';

const RecordJobBottomSheet = ({ field, jobTemplates, onSelectJob, onClose }) => {
	const { t } = useTranslation(['common', 'screens']);
	const navigation = useNavigation();
	const { farmData } = useGlobalContext();
	const { openBottomSheet, closeBottomSheet } = useBottomSheet();

	// Check availability for specific types
	const isTemplateAvailable = (template) => {
		switch (template.type) {
			case 'sow':
				return !field.currentCultivation;
			case 'harvest':
				return field.currentCultivation !== null;
			case 'spray':
			case 'irrigate':
			case 'custom':
			default:
				return true;
		}
	};

	// Get subtitle for template
	const getTemplateSubtitle = (template) => {
		// Check availability first
		if (!isTemplateAvailable(template)) {
			if (template.type === 'sow') {
				return t('screens:recordJob.fieldHasCultivation');
			} else if (template.type === 'harvest') {
				return t('screens:recordJob.noCultivationToHarvest');
			}
		}

		// Build equipment subtitle
		const parts = [];

		// Machine
		if (template.machine?.name) {
			parts.push(template.machine.name);
		} else {
			const machineId = template.machineId;
			if (machineId) {
				const machine = farmData?.machines?.find(m => m._id === machineId);
				if (machine) parts.push(machine.name);
			}
		}

		// Attachment
		if (template.attachment?.name) {
			parts.push(template.attachment.name);
		} else {
			const attachmentId = template.attachmentId || template.attachment;
			if (attachmentId) {
				const attachment = farmData?.attachments?.find(a => a._id === attachmentId);
				if (attachment) parts.push(attachment.name);
			}
		}

		// Tool
		if (template.tool?.name) {
			parts.push(template.tool.name);
		} else {
			const toolId = template.toolId || template.tool;
			if (toolId) {
				const tool = farmData?.tools?.find(t => t._id === toolId);
				if (tool) parts.push(tool.name);
			}
		}

		return parts.length > 0 ? parts.join(' • ') : '';
	};

	// Prepare templates with enriched data for search and display
	const allTemplates = useMemo(() => {
		if (!jobTemplates || jobTemplates.length === 0) return [];

		return jobTemplates.map(template => ({
			...template,
			_isAvailable: isTemplateAvailable(template),
			_searchSubtitle: getTemplateSubtitle(template),
			_typeLabel: t(`common:jobTypes.${template.type}`) || template.type
		}));
	}, [jobTemplates, field, farmData, t]);

	// Handle template selection
	const handleSelectTemplate = (template) => {
		if (!template._isAvailable) return;

		onSelectJob({
			templateId: template.id || template._id,
			type: template.type,
			fieldId: field._id,
			field: field
		});
	};

	// Navigate to template wizard via job type selection
	const handleCreateTemplate = () => {
		openBottomSheet(
			<SelectJobTypeBottomSheet onSelectType={(type) => {
				closeBottomSheet();
				navigation.navigate('TemplateWizardScreen', { selectedType: type });
			}} />,
			{
				snapPoints: ['75%'],
				isDismissible: true,
				borderColor: colors.PRIMARY
			}
		);
	};

	// Render template item
	const renderTemplateItem = ({ item, onSelect }) => (
		<TouchableOpacity
			style={[styles.jobItem, !item._isAvailable && styles.disabledJob]}
			onPress={() => onSelect(item)}
			disabled={!item._isAvailable}
		>
			<ListItem
				icon={config.JOB_TYPE_ICONS[item.type]}
				title={item.name}
				subTitle1={item._typeLabel}
				subTitle2={item._searchSubtitle}
				simple={true}
				showChevron={item._isAvailable}
			/>
		</TouchableOpacity>
	);

	// If no templates, show empty state
	if (allTemplates.length === 0) {
		return (
			<View style={styles.emptyContainer}>
				<View style={styles.header}>
					<Text style={styles.sheetTitle}>{t('screens:recordJob.selectTemplate')}</Text>
				</View>

				<EmptyState
					icon={require('../../assets/icons/job_icon.png')}
					title={t('screens:recordJob.noTemplates')}
					subtitle={t('screens:recordJob.noTemplatesSubtitle')}
					actionText={t('screens:recordJob.createTemplate')}
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

	// Custom header with field name
	const customHeader = (
		<View style={styles.fieldInfoHeader}>
			<Text style={styles.fieldInfo}>{field.name}</Text>
		</View>
	);

	return (
		<SearchableListSheet
			localData={allTemplates}
			searchKeys={['name', '_typeLabel', '_searchSubtitle']}
			searchPlaceholder={t('screens:recordJob.searchTemplates')}
			title={t('screens:recordJob.selectTemplate')}
			onSelect={handleSelectTemplate}
			renderItem={renderTemplateItem}
			keyExtractor={(item) => item._id || item.id}
			cancelLabel={t('common:buttons.cancel')}
			onCancel={onClose}
			emptyTitle={t('screens:recordJob.noTemplatesFound')}
			emptySubtitle={t('screens:recordJob.tryDifferentSearch')}
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
	disabledJob: {
		opacity: 0.5,
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

export default RecordJobBottomSheet;
