// client/src/components/modals/LocationPicker.js
// 🌍 V5 PRODUCTION-GRADE: Coordinated Cities + Smart GPS
// ─────────────────────────────────────────────────────────────────────
// Fixes vs prior:
//   [FIX-1] CRITICAL: Every popular city now has lat/lon → manual selection
//           no longer sends null coords (was breaking radar entirely)
//   [FIX-2] GPS: getLastKnownPositionAsync first (instant), then High accuracy
//           with 10s timeout fallback to Balanced
//   [FIX-3] AbortController-style timeout (Promise.race)
//   [FIX-4] Reverse-geocoding wrapped in try/catch — never blocks location set
//   [FIX-5] Removed potential render-time crash if userSettings is undefined
//   [FIX-6] Memoized location list creation
// ─────────────────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    Image, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAppStore } from '../../store/useAppStore';
import { brand } from '../../constants/data';

// ── Constants ────────────────────────────────────────────────────────
const GPS_TIMEOUT_MS = 10_000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;     // 5 min — accept cached fix
const REVERSE_GEOCODE_TIMEOUT_MS = 4_000;

// [FIX-1] Each city now carries lat/lon so manual selection produces a valid radar query.
const POPULAR_LOCATIONS = [
    // 🇵🇭 Philippines
    { id: '1',  name: 'Cebu City',        country: 'Philippines',  latitude: 10.3157, longitude: 123.8854, image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80' },
    { id: '2',  name: 'Moalboal',         country: 'Philippines',  latitude:  9.9491, longitude: 123.4017, image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80' },
    { id: '3',  name: 'Boracay',          country: 'Philippines',  latitude: 11.9674, longitude: 121.9248, image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80' },
    { id: '4',  name: 'Sumilon Island',   country: 'Philippines',  latitude:  9.4167, longitude: 123.3833, image: 'https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=400&q=80' },
    { id: '5',  name: 'Palawan',          country: 'Philippines',  latitude:  9.8349, longitude: 118.7384, image: 'https://images.unsplash.com/photo-1588392204645-8c764eb86259?w=400&q=80' },
    { id: '6',  name: 'Siargao',          country: 'Philippines',  latitude:  9.8601, longitude: 126.0463, image: 'https://images.unsplash.com/photo-1536697669466-9b5190eec26e?w=400&q=80' },
    { id: '7',  name: 'Manila',           country: 'Philippines',  latitude: 14.5995, longitude: 120.9842, image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80' },
    { id: '8',  name: 'Bohol',            country: 'Philippines',  latitude:  9.8500, longitude: 124.1435, image: 'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?w=400&q=80' },

    // 🌏 Asia
    { id: '9',  name: 'Tokyo',            country: 'Japan',        latitude: 35.6762, longitude: 139.6503, image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=400&q=80' },
    { id: '10', name: 'Kyoto',            country: 'Japan',        latitude: 35.0116, longitude: 135.7681, image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400&q=80' },
    { id: '11', name: 'Seoul',            country: 'South Korea',  latitude: 37.5665, longitude: 126.9780, image: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?w=400&q=80' },
    { id: '12', name: 'Bangkok',          country: 'Thailand',     latitude: 13.7563, longitude: 100.5018, image: 'https://images.unsplash.com/photo-1508009603885-50cf7cbf1ae3?w=400&q=80' },
    { id: '13', name: 'Phuket',           country: 'Thailand',     latitude:  7.8804, longitude:  98.3923, image: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=400&q=80' },
    { id: '14', name: 'Bali',             country: 'Indonesia',    latitude: -8.3405, longitude: 115.0920, image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
    { id: '15', name: 'Singapore',        country: 'Singapore',    latitude:  1.3521, longitude: 103.8198, image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80' },

    // 🌍 Middle East
    { id: '16', name: 'Tel Aviv',         country: 'Israel',       latitude: 32.0853, longitude:  34.7818, image: 'https://images.unsplash.com/photo-1518882570151-15711dcce92b?w=400&q=80' },
    { id: '17', name: 'Jerusalem',        country: 'Israel',       latitude: 31.7683, longitude:  35.2137, image: 'https://images.unsplash.com/photo-1544298621-03612803c4fc?w=400&q=80' },
    { id: '18', name: 'Dubai',            country: 'UAE',          latitude: 25.2048, longitude:  55.2708, image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80' },
    { id: '19', name: 'Istanbul',         country: 'Turkey',       latitude: 41.0082, longitude:  28.9784, image: 'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?w=400&q=80' },

    // 🇪🇺 Europe
    { id: '20', name: 'London',           country: 'UK',           latitude: 51.5074, longitude:  -0.1278, image: 'https://images.unsplash.com/photo-1513635269975-5969336cd1f5?w=400&q=80' },
    { id: '21', name: 'Paris',            country: 'France',       latitude: 48.8566, longitude:   2.3522, image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
    { id: '22', name: 'Berlin',           country: 'Germany',      latitude: 52.5200, longitude:  13.4050, image: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&q=80' },
    { id: '23', name: 'Rome',             country: 'Italy',        latitude: 41.9028, longitude:  12.4964, image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80' },
    { id: '24', name: 'Venice',           country: 'Italy',        latitude: 45.4408, longitude:  12.3155, image: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=400&q=80' },
    { id: '25', name: 'Amsterdam',        country: 'Netherlands',  latitude: 52.3676, longitude:   4.9041, image: 'https://images.unsplash.com/photo-1512470876302-972faa2aa9a4?w=400&q=80' },
    { id: '26', name: 'Barcelona',        country: 'Spain',        latitude: 41.3851, longitude:   2.1734, image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&q=80' },
    { id: '27', name: 'Madrid',           country: 'Spain',        latitude: 40.4168, longitude:  -3.7038, image: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&q=80' },
    { id: '28', name: 'Santorini',        country: 'Greece',       latitude: 36.3932, longitude:  25.4615, image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400&q=80' },
    { id: '29', name: 'Athens',           country: 'Greece',       latitude: 37.9838, longitude:  23.7275, image: 'https://images.unsplash.com/photo-1555993539-1732b0258235?w=400&q=80' },

    // 🌎 Americas
    { id: '30', name: 'New York',         country: 'USA',          latitude: 40.7128, longitude: -74.0060, image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
    { id: '31', name: 'Los Angeles',      country: 'USA',          latitude: 34.0522, longitude: -118.2437, image: 'https://images.unsplash.com/photo-1515896769740-41548e61b6e1?w=400&q=80' },
    { id: '32', name: 'Las Vegas',        country: 'USA',          latitude: 36.1699, longitude: -115.1398, image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=400&q=80' },
    { id: '33', name: 'Miami',            country: 'USA',          latitude: 25.7617, longitude:  -80.1918, image: 'https://images.unsplash.com/photo-1533106497176-45ae19e68ba2?w=400&q=80' },
    { id: '34', name: 'Hawaii',           country: 'USA',          latitude: 21.3099, longitude: -157.8581, image: 'https://images.unsplash.com/photo-1542259009477-d625272157b7?w=400&q=80' },
    { id: '35', name: 'Toronto',          country: 'Canada',       latitude: 43.6532, longitude:  -79.3832, image: 'https://images.unsplash.com/photo-1513628253939-010e64ac66cd?w=400&q=80' },
    { id: '36', name: 'Rio de Janeiro',   country: 'Brazil',       latitude: -22.9068, longitude: -43.1729, image: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=400&q=80' },
    { id: '37', name: 'Cancun',           country: 'Mexico',       latitude: 21.1619, longitude:  -86.8515, image: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=400&q=80' },

    // 🦘 Oceania & Africa
    { id: '38', name: 'Sydney',           country: 'Australia',    latitude: -33.8688, longitude: 151.2093, image: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&q=80' },
    { id: '39', name: 'Melbourne',        country: 'Australia',    latitude: -37.8136, longitude: 144.9631, image: 'https://images.unsplash.com/photo-1514395462725-fb4566210144?w=400&q=80' },
    { id: '40', name: 'Cape Town',        country: 'South Africa', latitude: -33.9249, longitude:  18.4241, image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=400&q=80' },
];

// ── Helpers ─────────────────────────────────────────────────────────
const withTimeout = (promise, ms, label = 'operation') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
        ),
    ]);

// ───────────────────────────────────────────────────────────────────
export default function LocationPicker({ onClose }) {
    const setUserLocation = useAppStore((s) => s.setUserLocation);
    const userSettings    = useAppStore((s) => s.userSettings);
    const isDark = userSettings?.darkMode === true;

    const [searchQuery, setSearchQuery] = useState('');
    const [isLocating, setIsLocating] = useState(false);

    // ── Search filter (with custom-search fallback) ─────────────────
    const filteredLocations = useMemo(() => {
        const trimmed = searchQuery.trim();
        if (!trimmed) return POPULAR_LOCATIONS;

        const q = trimmed.toLowerCase();
        const matches = POPULAR_LOCATIONS.filter((loc) =>
            loc.name.toLowerCase().includes(q) ||
            loc.country.toLowerCase().includes(q),
        );

        if (matches.length > 0) return matches;

        // No match — offer custom search WITHOUT coordinates (will be flagged downstream)
        return [{
            id: 'custom_search',
            name: trimmed,
            country: 'Search anywhere',
            latitude: null,
            longitude: null,
            image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=400&q=80',
        }];
    }, [searchQuery]);

    // ── GPS flow: cached → high-accuracy → balanced fallback ────────
    const handleGetCurrentLocation = useCallback(async () => {
        if (isLocating) return;
        setIsLocating(true);

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    'Permission Denied',
                    'Please enable location services in your phone settings.',
                );
                return;
            }

            let location = null;

            // [FIX-2] Step 1 — try cached fix (instant if available)
            try {
                location = await Location.getLastKnownPositionAsync({
                    maxAge: LAST_KNOWN_MAX_AGE_MS,
                    requiredAccuracy: 100,
                });
            } catch (_) {
                /* swallow — fallback to fresh fix */
            }

            // Step 2 — get a fresh High-accuracy fix (timed)
            if (!location) {
                try {
                    location = await withTimeout(
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
                        GPS_TIMEOUT_MS,
                        'High-accuracy GPS',
                    );
                } catch (_) {
                    // Step 3 — fallback to Balanced (faster, less precise)
                    location = await withTimeout(
                        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                        GPS_TIMEOUT_MS,
                        'Balanced GPS',
                    );
                }
            }

            const { latitude, longitude } = location.coords;

            // [FIX-4] Reverse-geocoding wrapped: failure here does NOT block location set
            let cityName = 'Current Location';
            try {
                const geocode = await withTimeout(
                    Location.reverseGeocodeAsync({ latitude, longitude }),
                    REVERSE_GEOCODE_TIMEOUT_MS,
                    'Reverse geocoding',
                );
                if (geocode && geocode.length > 0) {
                    const p = geocode[0];
                    cityName = p.city || p.subregion || p.region || p.country || 'Current Location';
                }
            } catch (geoErr) {
                console.warn('[LocationPicker] reverse-geocode failed:', geoErr?.message);
            }

            setUserLocation({ latitude, longitude, name: cityName });
            onClose?.();
        } catch (error) {
            console.warn('[LocationPicker] GPS error:', error?.message);
            Alert.alert(
                'Could not get your location',
                'Please try again or select a city manually.',
            );
        } finally {
            setIsLocating(false);
        }
    }, [isLocating, setUserLocation, onClose]);

    // ── Manual selection — now always carries lat/lon ───────────────
    const handleSelectLocation = useCallback((loc) => {
        // [FIX-1] Pass real coordinates so the radar works
        setUserLocation({
            latitude: loc.latitude ?? null,
            longitude: loc.longitude ?? null,
            name: loc.name,
        });

        if (loc.latitude == null && loc.id === 'custom_search') {
            // Custom search without coords — alert the user before closing
            Alert.alert(
                'No coordinates for this place',
                'Try one of the popular cities, or use GPS for your exact location.',
            );
            return;
        }
        onClose?.();
    }, [setUserLocation, onClose]);

    // ── Render ──────────────────────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#fff' }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#111' }]}>
                    Select Location
                </Text>
                {onClose && (
                    <TouchableOpacity
                        onPress={onClose}
                        style={[styles.closeBtn, { backgroundColor: isDark ? '#333' : '#f0f0f0' }]}
                    >
                        <Ionicons name="close" size={24} color={isDark ? '#fff' : '#111'} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={[
                styles.searchContainer,
                { backgroundColor: isDark ? '#2C2C2E' : '#F5F6F8', borderColor: isDark ? '#444' : '#eee' },
            ]}>
                <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                <TextInput
                    style={[styles.searchInput, { color: isDark ? '#fff' : '#111' }]}
                    placeholder="Search any city or country..."
                    placeholderTextColor={isDark ? '#aaa' : '#999'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#ccc" />
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity
                style={[styles.gpsButton, isLocating && { opacity: 0.7 }]}
                onPress={handleGetCurrentLocation}
                disabled={isLocating}
                activeOpacity={0.85}
            >
                {isLocating ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <>
                        <Ionicons name="navigate" size={20} color="#fff" />
                        <Text style={styles.gpsButtonText}>Use Current Location</Text>
                    </>
                )}
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: isDark ? '#aaa' : '#555' }]}>
                {searchQuery.length > 0 ? 'Search Results' : 'Popular Destinations'}
            </Text>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                nestedScrollEnabled={true}
                keyboardShouldPersistTaps="handled"
                style={styles.scrollStyle}
            >
                <View style={styles.gridContainer}>
                    {filteredLocations.map((item) => (
                        <TouchableOpacity
                            key={item.id}
                            style={[styles.locationCard, { backgroundColor: isDark ? '#333' : '#eee' }]}
                            activeOpacity={0.8}
                            onPress={() => handleSelectLocation(item)}
                        >
                            <Image source={{ uri: item.image }} style={styles.locationImage} />
                            <View style={styles.locationOverlay}>
                                <Text style={styles.locationName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.locationCountry} numberOfLines={1}>{item.country}</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

// ── Styles (unchanged from original — kept dark mode intact) ────────
const styles = StyleSheet.create({
    container: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 15 },
    header: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 20, position: 'relative',
    },
    headerTitle: { fontSize: 18, fontWeight: '900' },
    closeBtn: {
        position: 'absolute', right: 20, width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 20,
        borderRadius: 16, paddingHorizontal: 15, height: 50, marginBottom: 15, borderWidth: 1,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, height: '100%' },
    gpsButton: {
        flexDirection: 'row', backgroundColor: brand.blue || '#007AFF',
        marginHorizontal: 20, height: 50, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center', marginBottom: 25,
        shadowColor: brand.blue || '#007AFF', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 5, elevation: 4,
    },
    gpsButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '800', marginLeft: 20, marginBottom: 15 },
    scrollStyle: { flex: 1, width: '100%' },
    listContent: { paddingHorizontal: 15, paddingBottom: 40 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    locationCard: { width: '48%', height: 120, borderRadius: 16, overflow: 'hidden', marginBottom: 15 },
    locationImage: { width: '100%', height: '100%', position: 'absolute' },
    locationOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end', padding: 12 },
    locationName: {
        color: '#fff', fontSize: 15, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    },
    locationCountry: { color: '#ddd', fontSize: 11, fontWeight: '600' },
});