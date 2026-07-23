import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { getAvatarInitials } from '@/lib/avatarInitials';

export type MainScreenHeaderProps = {
  title: string;
  subtitle?: string;
  showAdd?: boolean;
  onAdd?: () => void;
  onProfilePress?: () => void;
  onNotificationsPress?: () => void;
  notificationsCount?: number;
  avatarColor?: string;
  avatarInitials?: string;
  variant?: 'default' | 'home';
  returnTo?: string;
};

export function MainScreenHeader({
  title,
  subtitle,
  showAdd = false,
  onAdd,
  onProfilePress,
  onNotificationsPress,
  notificationsCount = 0,
  avatarColor,
  avatarInitials,
  variant = 'default',
  returnTo,
}: MainScreenHeaderProps): React.JSX.Element {
  const router = useRouter();
  const currentUser = useQuery(api.users.getCurrentUser);
  const isHome = variant === 'home';
  const resolvedAvatarColor =
    avatarColor ?? currentUser?.profileColor ?? '#EAF7FD';
  const resolvedAvatarInitials =
    avatarInitials ?? getAvatarInitials({ fullName: currentUser?.fullName });
  const bellIconName =
    notificationsCount > 0 ? 'notifications' : 'notifications-none';

  const handleProfilePress = (): void => {
    if (onProfilePress) {
      onProfilePress();
      return;
    }
    router.push({
      pathname: '/(authenticated)/profile',
      params: { returnTo: returnTo ?? '' },
    });
  };

  return (
    <View style={styles.header}>
      <View style={styles.leftZone}>
        <Pressable
          style={styles.bellButton}
          onPress={onNotificationsPress}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel={
            notificationsCount > 0
              ? `התראות, ${notificationsCount} חדשות`
              : 'התראות'
          }
        >
          <MaterialIcons name={bellIconName} size={22} color="#111517" />
          {notificationsCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {notificationsCount > 9 ? '9+' : notificationsCount}
              </Text>
            </View>
          )}
        </Pressable>

        {showAdd && onAdd ? (
          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.75}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="הוספה"
            style={styles.headerAddButton}
          >
            <Plus size={18} color={colors.primaryDark} strokeWidth={2.4} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.centerZone}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit={true}
          minimumFontScale={isHome ? 0.72 : 0.9}
          style={[styles.title, isHome && styles.homeTitle]}
        >
          {title}
        </Text>
      </View>

      <View style={styles.rightZone}>
        <TouchableOpacity
          style={[
            styles.profileButton,
            { backgroundColor: resolvedAvatarColor },
          ]}
          onPress={handleProfilePress}
          activeOpacity={0.75}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="פתח פרופיל"
        >
          {resolvedAvatarInitials ? (
            <Text style={styles.profileInitials}>{resolvedAvatarInitials}</Text>
          ) : (
            <MaterialIcons
              name="person-outline"
              size={22}
              color={colors.primaryDark}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    height: 72,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
  },
  leftZone: {
    width: 112,
    height: 52,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  centerZone: {
    flex: 1,
    minWidth: 0,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightZone: {
    width: 112,
    height: 52,
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bellButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5EAF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bellBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  headerAddButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAF7FD',
    borderWidth: 1,
    borderColor: '#BEE7F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  title: {
    textAlign: 'center',
    writingDirection: 'rtl',
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  homeTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
});
