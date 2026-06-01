// client/src/components/SearchSheet.js
// ✅ STANDALONE — buildTheme מוטמע פנימה, אין תלות ב-search.utils.js

import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import {
    View, Text, FlatList, TextInput,
    TouchableOpacity, ActivityIndicator, StyleSheet
} from 'react-native';
import { styles } from '../constants/styles';
import { brand } from '../constants/data';
import { SettingsListHeader, SettingsListItem } from './ListItems';
import * as SocialService from '../store/social.service';

// ─── Inlined theme helper (לא נדרש search.utils.js) ─────────────────────────

const buildTheme = (isDark) => ({
    surface:       isDark ? '#1C1C1E' : '#fff',
    border:        isDark ? '#333'    : '#f0f0f0',
    text:          isDark ? '#fff'    : '#111',
    textSecondary: isDark ? '#aaa'    : '#888',
    inputBg:       isDark ? '#1C1C1E' : '#e9ecef',
    iconColor:     isDark ? '#888'    : '#999',
    isDark,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS   = 400;
const MIN_QUERY_LEN = 2;

// ─── SearchSheet ──────────────────────────────────────────────────────────────

const SearchSheet = ({ onClose, setThirdSheet, setProfilePeek, openChat, isDark = false }) => {
    const theme = buildTheme(isDark);

    const [query,        setQuery]        = useState('');
    const [isLoading,    setIsLoading]    = useState(false);
    const [results,      setResults]      = useState([]);
    const [errorMessage, setErrorMessage] = useState(null);

    const searchTimeout = useRef(null);
    const isMounted     = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, []);

    const executeSearch = useCallback(async (searchText) => {
        if (!isMounted.current) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
            const raw = await SocialService.searchGlobal(searchText);

            // תמיכה במספר צורות של API response
            let data = raw;
            if (raw?.data && (raw.data.users != null || raw.data.groups != null)) {
                data = raw.data;
            }

            const users  = Array.isArray(data?.users)  ? data.users  : [];
            const groups = Array.isArray(data?.groups) ? data.groups : [];

            if (!isMounted.current) return;

            const newResults = [];

            if (users.length > 0) {
                newResults.push({ type: 'header', title: 'PEOPLE', id: 'header-people' });
                users.forEach((u, i) => {
                    newResults.push({
                        type:  'user',
                        icon:  '👤',
                        title: u.name || u.username || 'Unknown User',
                        body:  u.username ? `@${u.username}` : '',
                        id:    u.id != null ? String(u.id) : `user-${i}`,
                        data:  u,
                    });
                });
            }

            if (groups.length > 0) {
                newResults.push({ type: 'header', title: 'GROUPS', id: 'header-groups' });
                groups.forEach((g, i) => {
                    newResults.push({
                        type:  'group',
                        icon:  '👥',
                        title: g.name || 'Unnamed Group',
                        body:  g.description || `${g.memberCount || 0} members`,
                        id:    g.id != null ? String(g.id) : `group-${i}`,
                        data:  g,
                    });
                });
            }

            setResults(newResults);

        } catch (e) {
            console.error('[SearchSheet] API Error:', e);
            if (isMounted.current) {
                setErrorMessage('Search failed. Please try again.');
            }
        } finally {
            if (isMounted.current) setIsLoading(false);
        }
    }, []);

    const handleSearch = useCallback((text) => {
        setQuery(text);
        setErrorMessage(null);

        const searchText = text.trim();

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (searchText.length < MIN_QUERY_LEN) {
            setResults([]);
            return;
        }

        searchTimeout.current = setTimeout(() => {
            executeSearch(searchText);
        }, DEBOUNCE_MS);
    }, [executeSearch]);

    const handleResultPress = useCallback((item) => {
        if (item.type === 'user') {
            setProfilePeek({
                id:        String(item.data.id),
                name:      item.data.name,
                username:  item.data.username,
                avatarUrl: item.data.avatarUrl,
                bio:       item.data.intent || item.data.bio,
            });
        } else if (item.type === 'group') {
            setThirdSheet({ source: 'GroupDetails', group: item.data });
        }
    }, [setProfilePeek, setThirdSheet]);

    const renderItem = useCallback(({ item }) => {
        if (item.type === 'header') {
            return <SettingsListHeader key={item.id} title={item.title} />;
        }
        return (
            <SettingsListItem
                key={item.id}
                icon={<Text style={styles.listItemIcon}>{item.icon}</Text>}
                title={item.title}
                body={item.body}
                next={true}
                onPress={() => handleResultPress(item)}
            />
        );
    }, [handleResultPress]);

    const keyExtractor = useCallback((item) => item.id, []);

    return (
        <View style={[sheetStyles.container, { backgroundColor: theme.surface }]}>
            {/* Header */}
            <View style={[styles.modalHeader, sheetStyles.searchHeader, { borderBottomColor: theme.border }]}>
                <TextInput
                    placeholder="Search people & groups..."
                    placeholderTextColor={theme.iconColor}
                    style={[styles.input, sheetStyles.searchInput, { color: theme.text, backgroundColor: theme.inputBg }]}
                    value={query}
                    onChangeText={handleSearch}
                    autoFocus
                    returnKeyType="search"
                    autoCorrect={false}
                    accessibilityLabel="Search input"
                />
                <TouchableOpacity onPress={onClose} style={sheetStyles.closeButton} accessibilityRole="button" accessibilityLabel="Close search">
                    <Text style={{ color: brand.soft, fontSize: 18 }}>Close</Text>
                </TouchableOpacity>
            </View>

            {/* Error banner */}
            {errorMessage && !isLoading && (
                <View style={sheetStyles.errorBanner}>
                    <Text style={sheetStyles.errorText}>{errorMessage}</Text>
                </View>
            )}

            {/* Results */}
            {isLoading ? (
                <ActivityIndicator size="large" color={brand.blue} style={sheetStyles.loader} accessibilityLabel="Loading results" />
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    contentContainerStyle={sheetStyles.listContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        query.trim().length >= MIN_QUERY_LEN ? (
                            <Text style={[styles.p, sheetStyles.emptyText, { color: theme.textSecondary }]}>
                                No results found.
                            </Text>
                        ) : (
                            <View style={sheetStyles.emptyState}>
                                <Text style={sheetStyles.emptyEmoji}>🔍</Text>
                                <Text style={[styles.p, { color: theme.textSecondary }]}>
                                    Type to search for friends...
                                </Text>
                            </View>
                        )
                    }
                />
            )}
        </View>
    );
};

export default memo(SearchSheet);

const sheetStyles = StyleSheet.create({
    container:    { flex: 1 },
    searchHeader: { borderBottomWidth: 1, paddingTop: 20, paddingHorizontal: 12 },
    searchInput:  { flex: 1, height: 48, marginRight: 10, marginBottom: 0, borderRadius: 10, paddingHorizontal: 12 },
    closeButton:  { padding: 10 },
    loader:       { marginTop: 40 },
    listContent:  { paddingBottom: 50, paddingHorizontal: 16 },
    emptyText:    { textAlign: 'center', marginTop: 40 },
    emptyState:   { marginTop: 40, alignItems: 'center' },
    emptyEmoji:   { fontSize: 40, marginBottom: 10 },
    errorBanner:  { backgroundColor: '#FFF3F3', borderWidth: 1, borderColor: '#FFCDD2', marginHorizontal: 16, marginTop: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
    errorText:    { color: '#D32F2F', fontSize: 13, textAlign: 'center' },
});