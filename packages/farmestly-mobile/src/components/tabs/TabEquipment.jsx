import React from 'react';
import { View, StyleSheet, Text, Image, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useGlobalContext } from '../context/GlobalContextProvider';
import { useUnits } from '../../providers/UnitsProvider';
import SwipeableTabs from '../ui/core/SwipableTabs';
import { ScrollView } from 'react-native-gesture-handler';

import ListItem from '../ui/list/ListItem';
import PrimaryButton from '../ui/core/PrimaryButton';
import { useNavigation } from '@react-navigation/core';
import colors from '../../globals/colors';

const TabEquipment = () => {
	const { t } = useTranslation(['screens', 'common']);
	const { farmData } = useGlobalContext();
	const navigation = useNavigation();
	const { formatValue } = useUnits();

	// Guard against missing farmData (e.g., offline with no cache)
	const machines = farmData?.machines || [];
	const attachments = farmData?.attachments || [];
	const tools = farmData?.tools || [];

	return (
		<SwipeableTabs
			initialTab={0}
			tabs={[
				{
					key: 'machinery',
					title: t('common:general.machinery'),
					content: (
						<View style={styles.tabContainer}>
							{machines.length === 0 ? (
								<View style={styles.emptyTextContainer}>
									<Image
										source={require('../../assets/icons/tractor_brown.png')}
										style={styles.emptyIcon}
										resizeMode="contain"
									/>
									<Text style={styles.emptyText}>{t('screens:equipment.noMachines')}</Text>
									<Text style={styles.emptyTextSub}>{t('screens:equipment.addMachine')}</Text>
								</View>
							) : (
								<ScrollView
									style={styles.scrollView}
									contentContainerStyle={styles.scrollContent}
									showsVerticalScrollIndicator={true}
								>
									{machines.map((machine) => {
										return (
											<TouchableOpacity
												key={'machine-' + machine._id}
												onPress={() => {
													navigation.navigate('EditEntityScreen', {
														entityType: 'machine',
														entity: machine,
														isAdding: false
													});
												}}
											>
												<ListItem
													icon={require('../../assets/icons/tractor_brown.png')}
													timeCount={formatValue(machine.powerOnTime, 'time')}
													subTitle1={machine.make}
													title={machine.name}
													subTitle2={machine.licenceNo}
													showChevron={true}
												/>
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							)}
							<View style={styles.buttonContainer}>
								<PrimaryButton
									text={t('common:buttons.add')}
									style={{ width: 300 }}
									onPress={() => {
										navigation.navigate('EditEntityScreen', {
											entityType: 'machine',
											isAdding: true
										});
									}}
								/>
							</View>
						</View>
					)
				},
				{
					key: 'attachments',
					title: t('common:general.attachments'),
					content: (
						<View style={styles.tabContainer}>
							{attachments.length === 0 ? (
								<View style={styles.emptyTextContainer}>
									<Image
										source={require('../../assets/icons/plow_brown.png')}
										style={styles.emptyIcon}
										resizeMode="contain"
									/>
									<Text style={styles.emptyText}>{t('screens:equipment.noAttachments')}</Text>
									<Text style={styles.emptyTextSub}>{t('screens:equipment.addAttachment')}</Text>
								</View>
							) : (
								<ScrollView
									style={styles.scrollView}
									contentContainerStyle={styles.scrollContent}
									showsVerticalScrollIndicator={true}
								>
									{attachments.map((attachment) => {
										return (
											<TouchableOpacity
												key={'attachment-' + attachment._id}
												onPress={() => {
													navigation.navigate('EditEntityScreen', {
														entityType: 'attachment',
														entity: attachment,
														isAdding: false
													});
												}}
											>
												<ListItem
													icon={require('../../assets/icons/plow_brown.png')}
													timeCount={formatValue(attachment.powerOnTime, 'time')}
													subTitle1={attachment.make}
													title={attachment.name}
													subTitle2={attachment.type}
													showChevron={true}
												/>
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							)}
							<View style={styles.buttonContainer}>
								<PrimaryButton
									text={t('common:buttons.add')}
									style={{ width: 300 }}
									onPress={() => {
										navigation.navigate('EditEntityScreen', {
											entityType: 'attachment',
											isAdding: true
										});
									}}
								/>
							</View>
						</View>
					)
				}, 
				{
					key: 'tools',
					title: t('common:general.tools'),
					content: (
						<View style={styles.tabContainer}>
							{tools.length === 0 ? (
								<View style={styles.emptyTextContainer}>
									<Image
										source={require('../../assets/icons/tool.png')}
										style={styles.emptyIcon}
										resizeMode="contain"
									/>
									<Text style={styles.emptyText}>{t('screens:equipment.noTools')}</Text>
									<Text style={styles.emptyTextSub}>{t('screens:equipment.addTool')}</Text>
								</View>
							) : (
								<ScrollView
									style={styles.scrollView}
									contentContainerStyle={styles.scrollContent}
									showsVerticalScrollIndicator={true}
								>
									{tools.map((tool) => {
										return (
											<TouchableOpacity
												key={'tool-' + tool._id}
												onPress={() => {
													navigation.navigate('EditEntityScreen', {
														entityType: 'tool',
														entity: tool,
														isAdding: false
													});
												}}
											>
												<ListItem
													icon={require('../../assets/icons/tool.png')}
													subTitle1={tool.brand}
													timeCount={formatValue(tool.powerOnTime, 'time')}
													title={tool.name}
													subTitle2={tool.type}
													showChevron={true}
												/>
											</TouchableOpacity>
										);
									})}
								</ScrollView>
							)}
							<View style={styles.buttonContainer}>
								<PrimaryButton
									text={t('common:buttons.add')}
									style={{ width: 300 }}
									onPress={() => {
										navigation.navigate('EditEntityScreen', {
											entityType: 'tool',
											isAdding: true
										});
									}}
								/>
							</View>
						</View>
					)
				}
			]}
		/>
	);
};

const styles = StyleSheet.create({
	tabContainer: {
		flex: 1,
		position: 'relative',
	},
	scrollView: {
		flex: 1,
		paddingHorizontal: 16,
	},
	scrollContent: {
		paddingBottom: 180,
	},
	buttonContainer: {
		position: 'absolute',
		alignSelf: 'center',
		bottom: 120
	},
	emptyTextContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 32,
	},
	emptyIcon: {
		width: 80,
		height: 80,
		opacity: 0.3,
		marginBottom: 16,
	},
	emptyText: {
		fontSize: 18,
		fontFamily: 'Geologica-Bold',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
		marginBottom: 8,
	},
	emptyTextSub: {
		fontSize: 14,
		fontFamily: 'Geologica-Regular',
		color: colors.PRIMARY_LIGHT,
		textAlign: 'center',
	}
});

export default TabEquipment;