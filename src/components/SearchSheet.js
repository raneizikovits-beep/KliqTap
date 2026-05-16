// client/src/components/SearchSheet.js
// ⭐️ FINAL FIXED VERSION: Real API Search via SocialService + Debounce + String IDs ⭐️

import React, { useState, useCallback, useRef, memo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { styles } from '../constants/styles';
import { brand } from '../constants/data';
import { SettingsListHeader, SettingsListItem } from './ListItems';
// [REFACTOR] Use SocialService instead of direct fetchAPI
import * as SocialService from '../store/social.service';

const SearchSheet = ({ onClose, setThirdSheet, setProfilePeek, openChat }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState([]); 
    
    const searchTimeout = useRef(null);

    const executeSearch = async (searchText) => {
        setIsLoading(true);
        try {
            // [REFACTOR] Single global search through service — backend returns
            // { users, groups, posts } in one call (faster + more efficient).
            const data = await SocialService.searchGlobal(searchText);
            const users = Array.isArray(data?.users) ? data.users : [];
            const groups = Array.isArray(data?.groups) ? data.groups : [];

            const newResults = [];

            if (users.length > 0) {
                newResults.push({ type: 'header', title: 'PEOPLE' });
                users.forEach(u => {
                    newResults.push({
                        type: 'user',
                        icon: '👤', 
                        title: u.name || u.username || 'Unknown User', 
                        body: u.username ? `@${u.username}` : '',
                        id: String(u.id), // [FIX] always string
                        data: u 
                    });
                });
            }

            if (groups.length > 0) {
                newResults.push({ type: 'header', title: 'GROUPS' });
                groups.forEach(g => {
                    newResults.push({
                        type: 'group',
                        icon: '👥', 
                        title: g.name || 'Unnamed Group', 
                        body: g.description || `${g.memberCount || 0} members`,
                        id: String(g.id), // [FIX] always string
                        data: g
                    });
                });
            }

            setResults(newResults);
        } catch (e) {
            console.error("Search API Error:", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = useCallback((text) => {
        setQuery(text);
        const searchText = text.trim();
        
        if (searchText.length < 2) {
            setResults([]); 
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            return;
        }

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            executeSearch(searchText);
        }, 400);
        
    }, []);
    
    const handleResultPress = useCallback((item) => {
        if (item.type === 'user') {
            setProfilePeek({ 
                id: String(item.data.id), // [FIX] always string
                name: item.data.name, 
                username: item.data.username,
                avatarUrl: item.data.avatarUrl,
                bio: item.data.intent || item.data.bio
            }); 
        } else if (item.type === 'group') {
            setThirdSheet({ 
                source: "GroupDetails", 
                group: item.data 
            });
        }
    }, [setProfilePeek, setThirdSheet]);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={[styles.modalHeader, { borderBottomWidth: 0, paddingTop: 20 }]}>
                <TextInput
                    placeholder="Search people & groups..."
                    placeholderTextColor="#888"
                    style={[styles.input, { flex: 1, height: 48, marginRight: 10, marginBottom: 0 }]}
                    value={query}
                    onChangeText={handleSearch}
                    autoFocus
                    returnKeyType="search"
                />
                <TouchableOpacity onPress={onClose} style={{ padding: 10 }}>
                    <Text style={{ color: brand.soft, fontSize: 18 }}>Close</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 50, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
                {isLoading ? (
                    <ActivityIndicator size="large" color={brand.blue} style={{ marginTop: 40 }} />
                ) : (
                    results.map((item, index) => {
                        if (item.type === 'header') { 
                            return <SettingsListHeader key={`hdr-${index}`} title={item.title} />; 
                        } 
                        return (
                            <SettingsListItem 
                                key={item.id || `item-${index}`} 
                                icon={<Text style={styles.listItemIcon}>{item.icon}</Text>} 
                                title={item.title} 
                                body={item.body} 
                                next={true}
                                onPress={() => handleResultPress(item)}
                            />
                        );
                    })
                )}
                
                {!isLoading && results.length === 0 && query.trim().length > 1 && (
                    <Text style={[styles.p, { textAlign: 'center', marginTop: 40, color: '#999' }]}>
                        No results found.
                    </Text>
                )}
                
                {!isLoading && query.trim().length === 0 && (
                    <View style={{ marginTop: 40, alignItems: 'center' }}>
                        <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
                        <Text style={[styles.p, { color: '#999' }]}>Type to search for friends...</Text>
                    </View>
                )}

            </ScrollView>
        </View>
    );
};

export default memo(SearchSheet);