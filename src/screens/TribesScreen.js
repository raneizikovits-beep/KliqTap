// client/src/screens/TribesScreen.js
// ⭐️ ULTIMATE TRIBES VERSION: Full CRUD & Database Sync ⭐️

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, RefreshControl, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Data from '../constants/data';
import { useAppStore } from '../store/useAppStore'; 

const CompactGroupCard = React.memo(({ group, onJoin, onPress, onLeave, onEdit, onDelete, isDark, isOwner }) => {
    const totalMembers = group.memberCount || group.member_count || 0; 
    const onlineCount = group.onlineCount || 0;
    const onlinePercent = totalMembers > 0 ? (onlineCount / totalMembers) * 100 : 0;

    const cardBg = isDark ? '#1C1C1E' : '#fff';
    const textColor = isDark ? '#fff' : '#333';
    const subTextColor = isDark ? '#aaa' : '#888';
    const btnBg = isDark ? '#333' : '#222';

    return (
        <TouchableOpacity 
            style={[localStyles.compactCard, { backgroundColor: cardBg }]} 
            activeOpacity={0.7} 
            onPress={onPress}
        >
            <Image 
                source={{ uri: group.image || `https://ui-avatars.com/api/?name=${group.name}&background=random&size=128` }} 
                style={localStyles.compactImage} 
            />
            <View style={localStyles.compactContent}>
                <View style={localStyles.rowSpaceBetween}>
                    <Text style={[localStyles.compactTitle, { color: textColor }]} numberOfLines={1}>{group.name}</Text>
                    {isOwner && <Ionicons name="shield-checkmark" size={14} color={Data.brand.blue} style={{marginLeft: 4}} />}
                </View>
                <Text style={[localStyles.compactDesc, { color: subTextColor }]} numberOfLines={1}>
                    {group.description || "Community vibes only."}
                </Text>
                <View style={localStyles.activityRow}>
                    <View style={[localStyles.barTrack, { backgroundColor: isDark ? '#333' : '#eee' }]}>
                        <View style={[localStyles.barFill, { width: `${onlinePercent}%` }]} />
                    </View>
                    <Text style={localStyles.activityText}>
                        <Text style={localStyles.activityTextHighlight}>{onlineCount}</Text>/{totalMembers}
                    </Text>
                </View>
            </View>

            <View style={localStyles.actionColumn}>
                {/* כפתור הצטרפות/עזיבה */}
                {group.isMember ? (
                    <TouchableOpacity style={[localStyles.compactActionBtn, localStyles.leaveBtn]} onPress={onLeave}>
                        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[localStyles.compactActionBtn, { backgroundColor: btnBg }]} onPress={onJoin}>
                        <Ionicons name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                )}

                {/* כפתורי ניהול (רק לבעלים) */}
                {isOwner && (
                    <View style={localStyles.ownerActions}>
                        <TouchableOpacity style={localStyles.miniActionBtn} onPress={onEdit}>
                            <Ionicons name="create-outline" size={16} color={isDark ? "#aaa" : "#666"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={localStyles.miniActionBtn} onPress={onDelete}>
                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
});

export default function TribesScreen({ setSecondSheet, setGroupModalTab }) {
    const { 
        groups = [], // שימוש ב-groups הכללי מהדאטה-בייס
        isGroupsLoading, 
        joinGroup, 
        leaveGroup, 
        deleteGroup, // פונקציית מחיקה מה-Store
        user,
        userLocation, 
        fetchExploreData, 
        refreshAllData,
        userSettings 
    } = useAppStore(); 

    const [refreshing, setRefreshing] = useState(false);
    const isDark = userSettings?.darkMode === true;

    useEffect(() => {
        fetchExploreData();
        if (refreshAllData) refreshAllData(); // סנכרון מלא בטעינה[cite: 11]
    }, [fetchExploreData, refreshAllData]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchExploreData();
        if (refreshAllData) await refreshAllData();
        setRefreshing(false);
    }, [fetchExploreData, refreshAllData]);

    const handleJoinGroup = useCallback(async (group) => {
        try {
            await joinGroup(String(group.id));
            Alert.alert("Joined", `Welcome to ${group.name}`);
        } catch (error) { Alert.alert("Error", "Could not join."); }
    }, [joinGroup]);

    const handleLeaveGroup = useCallback(async (group) => {
        try {
            await leaveGroup(String(group.id));
            Alert.alert("Left", `You have left ${group.name}`);
        } catch (error) { Alert.alert("Error", "Could not leave."); }
    }, [leaveGroup]);

    const handleDeleteGroup = useCallback((group) => {
        Alert.alert(
            "Delete Tribe",
            `Are you sure you want to delete ${group.name}? This cannot be undone.`,
            [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: async () => {
                    try {
                        if (deleteGroup) await deleteGroup(group.id);
                        Alert.alert("Deleted", "Tribe has been removed.");
                    } catch (e) { Alert.alert("Error", "Failed to delete."); }
                }}
            ]
        );
    }, [deleteGroup]);

    const renderHeader = () => (
        <View style={localStyles.groupHeaderWrapper}>
            <Text style={localStyles.groupSectionTitle}>EXPLORE TRIBES</Text>
            <TouchableOpacity 
                onPress={() => setSecondSheet({ source: "LocationPicker" })} 
                style={[localStyles.locationChip, { backgroundColor: isDark ? '#1C1C1E' : '#fff', borderColor: isDark ? '#333' : '#eee' }]}
            >
                <Ionicons name="navigate" size={12} color={Data.brand.blue} />
                <Text style={localStyles.locationText}>{userLocation?.name || 'Global'}</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={[localStyles.mainContainer, { backgroundColor: isDark ? '#000' : '#F9FAFB' }]}>
            <FlatList 
                data={groups}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => (
                    <CompactGroupCard 
                        group={item} 
                        isOwner={item.ownerId === user?.id || item.created_by === user?.id}
                        onJoin={() => handleJoinGroup(item)} 
                        onLeave={() => handleLeaveGroup(item)} 
                        onEdit={() => setSecondSheet({ source: "EditGroup", group: item })}
                        onDelete={() => handleDeleteGroup(item)}
                        onPress={() => { setGroupModalTab('posts'); setSecondSheet({ source: "GroupDetails", group: item }); }} 
                        isDark={isDark} 
                    />
                )}
                ListHeaderComponent={renderHeader}
                ListEmptyComponent={!isGroupsLoading && <Text style={localStyles.emptyText}>No tribes found. Create the first one!</Text>}
                contentContainerStyle={localStyles.flatListContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Data.brand.blue} />}
            />
        </View>
    );
}

const localStyles = StyleSheet.create({
    mainContainer: { flex: 1, paddingTop: 10 },
    flatListContent: { paddingBottom: 120 },
    groupHeaderWrapper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, paddingHorizontal: 20, marginTop: 10 },
    groupSectionTitle: { fontSize: 13, fontWeight: '900', color: '#999', letterSpacing: 1 },
    locationChip: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    locationText: { fontSize: 11, fontWeight: '700', color: Data.brand.blue, marginLeft: 4 },
    compactCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 12, marginBottom: 12, marginHorizontal: 20, elevation: 2 },
    compactImage: { width: 56, height: 56, borderRadius: 14 },
    compactContent: { flex: 1, marginLeft: 14 },
    rowSpaceBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    compactTitle: { fontSize: 15, fontWeight: 'bold' },
    compactDesc: { fontSize: 12 },
    activityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    barTrack: { width: 60, height: 4, borderRadius: 2, marginRight: 8 },
    barFill: { height: '100%', backgroundColor: Data.brand.green, borderRadius: 2 },
    activityText: { fontSize: 10, color: '#999' },
    activityTextHighlight: { color: Data.brand.green, fontWeight: 'bold' },
    actionColumn: { alignItems: 'center', gap: 8 },
    compactActionBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    leaveBtn: { backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1 },
    ownerActions: { flexDirection: 'row', gap: 4 },
    miniActionBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
    emptyText: { textAlign: 'center', marginTop: 40, color: '#999' }
});