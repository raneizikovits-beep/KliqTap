import React, { memo } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  StyleSheet 
} from 'react-native';
import { styles as globalStyles } from '../../constants/styles';
import { brand } from '../../constants/data';

/**
 * BaseSheet Component
 * עבר אופטימיזציה עם memo למניעת רינדור מיותר של מעטפת המודל
 */
const BaseSheet = ({ 
    visible, 
    onClose, 
    title, 
    children, 
    sheetHeight = '85%', 
    showBackButton = false, 
    onBackPress 
}) => {
    if (!visible) return null;
    
    return (
        <Modal 
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView 
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={localStyles.modalOverlay}
            >
                <View style={[localStyles.sheetContainer, { height: sheetHeight }]}>
                    
                    <View style={globalStyles.sheetHandleBar} />

                    <View style={localStyles.headerContainer}>
                        {showBackButton ? (
                            <TouchableOpacity onPress={onBackPress || onClose} style={localStyles.headerButton}>
                                <Text style={[globalStyles.p, localStyles.backText]}>{'< Back'}</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={onClose} style={localStyles.headerButton}>
                                <Text style={[globalStyles.p, localStyles.closeText]}>Close</Text>
                            </TouchableOpacity>
                        )}
                        
                        <Text style={localStyles.headerTitle} numberOfLines={1}>
                            {title}
                        </Text>
                        
                        <View style={{ width: 40 }} /> 
                    </View>
                    
                    <ScrollView 
                        contentContainerStyle={localStyles.scrollContent} 
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {children}
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default memo(BaseSheet);

const localStyles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    sheetContainer: { backgroundColor: brand.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
    headerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    headerButton: { padding: 5, minWidth: 40 },
    backText: { fontWeight: '700', color: brand.blue },
    closeText: { fontWeight: '700', color: brand.red },
    headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: brand.ink },
    scrollContent: { paddingBottom: 50 }
});