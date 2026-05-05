import { MaterialIcons } from '@expo/vector-icons';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import {
  getOpenCommunityCalendarActionLabel,
  isOpenCommunityCalendarActionVisible,
  isOpenCommunityInformationalLabelVisible,
} from '@/lib/openCommunityCalendarUi';
import { getFlexDirection, getTextAlign } from '@/lib/rtl';

/** Native RTL (iOS/Android) מפיל literal textAlign:'right' — ראה lib/rtl.ts */
const HEB_TEXT_ALIGN = getTextAlign() ?? 'right';
const HEB_ROW = getFlexDirection();

const { height: screenHeight } = Dimensions.get('window');
const SHEET_HEIGHT = screenHeight * 0.9;
const RSVP_DETAIL_MODAL_MAX_HEIGHT = screenHeight * 0.62;
const RSVP_DETAIL_SCROLL_MAX_HEIGHT = RSVP_DETAIL_MODAL_MAX_HEIGHT - 160;

/** RSVP — strong fills + borders so controls read as real buttons on light cards */
const MEMBER_RSVP_OPTIONS = [
  {
    status: 'yes' as const,
    label: 'כן',
    selectedBg: '#dcfce7',
    selectedBorder: '#16a34a',
    selectedText: '#14532d',
  },
  {
    status: 'maybe' as const,
    label: 'אולי',
    selectedBg: '#fef3c7',
    selectedBorder: '#d97706',
    selectedText: '#92400e',
  },
  {
    status: 'no' as const,
    label: 'לא',
    selectedBg: '#fee2e2',
    selectedBorder: '#dc2626',
    selectedText: '#991b1b',
  },
] as const;

const RSVP_BTN_BORDER_IDLE = '#475569';
/** Must contrast with sectionCard (#f8fafc) — white alone reads as “text only” */
const RSVP_BTN_BG_IDLE = '#eef2f7';

function getBottomSheetRsvpHelperText(
  status: 'yes' | 'no' | 'maybe' | 'none'
): string | null {
  if (status === 'yes') {
    return 'אישרת הגעה';
  }
  if (status === 'maybe') {
    return 'סימנת אולי';
  }
  if (status === 'no') {
    return 'סימנת שלא תגיע/י';
  }
  return null;
}

function rsvpRowDisplayName(row: {
  displayName?: string;
  userId: string;
}): string {
  const trimmed = row.displayName?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'משתמש';
}

export interface EventItem {
  id: string;
  time: string;
  endTime?: string;
  title: string;
  location?: string;
  type: 'event' | 'task';
  iconColor: string;
  completed: boolean;
  allDay?: boolean;
  pending?: boolean;
  groupName?: string;
  description?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  reminders?: number[];
  canEdit?: boolean;
  /** Convex community id when this row is a community (or saved community) event */
  communityId?: string;
  /** From listByDateRange / listCommunity… when known */
  isSavedToMyCalendar?: boolean;
}

interface EventDetailsBottomSheetProps {
  event?: EventItem | null;
  eventId?: string | null;
  visible: boolean;
  onClose: () => void;
  onDragClose?: () => void;
  onNavigate: (location: string) => void;
}

type Attachment = {
  storageId: Id<'_storage'>;
  originalName: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
};

const googleMapsIcon = require('@/assets/images/navigation/google-maps.png');
const wazeIcon = require('@/assets/images/navigation/waze.png');

export function EventDetailsBottomSheet({
  event,
  eventId,
  visible,
  onClose,
  onDragClose,
  onNavigate: _onNavigate,
}: EventDetailsBottomSheetProps): React.JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [navPickerOpen, setNavPickerOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [participantRsvpDetailsOpen, setParticipantRsvpDetailsOpen] =
    useState(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const [isClosingState, setIsClosingState] = useState(false);
  const handlePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 5 && Math.abs(gesture.dx) < Math.abs(gesture.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        sheetTranslateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (isClosingRef.current) return;

        const shouldClose = gesture.dy > 80 || gesture.vy > 1.1;

        if (shouldClose) {
          isClosingRef.current = true;
          setIsClosingState(true);
          onDragClose?.();
          Animated.timing(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            duration: 160,
            useNativeDriver: true,
          }).start(() => {
            sheetTranslateY.setValue(0);
            onClose();
          });
          return;
        }

        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(sheetTranslateY, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      setIsClosingState(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setParticipantRsvpDetailsOpen(false);
    }
  }, [visible]);

  const handleRequestClose = (): void => {
    if (isClosingRef.current) return;
    onClose();
  };
  const convexEventId =
    eventId && isValidConvexId(eventId) ? (eventId as Id<'events'>) : null;

  const cancelEventMutation = useMutation(api.events.cancelEvent);
  const deleteEventMutation = useMutation(api.events.deleteEvent);
  const createShareLinkMutation = useMutation(api.shareLinks.createShareLink);
  const upsertRsvpMutation = useMutation(api.eventRsvps.upsertRsvp);
  const addCommunityEventToMyCalendar = useMutation(
    api.communityEventCalendar.addCommunityEventToMyCalendar
  );
  const removeCommunityEventFromMyCalendar = useMutation(
    api.communityEventCalendar.removeCommunityEventFromMyCalendar
  );

  const handleRsvp = useCallback(
    (status: 'yes' | 'no' | 'maybe') => {
      if (!convexEventId) return;
      upsertRsvpMutation({ eventId: convexEventId, status }).catch(() =>
        Alert.alert('שגיאה', 'לא ניתן לשמור תגובה')
      );
    },
    [convexEventId, upsertRsvpMutation]
  );

  const eventDoc = useQuery(
    api.events.getById,
    convexEventId ? { eventId: convexEventId } : 'skip'
  );

  const handleOpenCalendarToggle = useCallback((): void => {
    if (!convexEventId || eventDoc === undefined || eventDoc === null) return;
    const isSaved = eventDoc.isSavedToMyCalendar === true;
    const run = isSaved
      ? removeCommunityEventFromMyCalendar
      : addCommunityEventToMyCalendar;
    run({ eventId: convexEventId }).catch(() =>
      Alert.alert('שגיאה', 'לא ניתן לעדכן את היומן')
    );
  }, [
    convexEventId,
    eventDoc,
    addCommunityEventToMyCalendar,
    removeCommunityEventFromMyCalendar,
  ]);
  const eventTasks = useQuery(
    api.eventTasks.listByEvent,
    convexEventId ? { eventId: convexEventId } : 'skip'
  );
  const rsvps = useQuery(
    api.eventRsvps.listByEvent,
    convexEventId ? { eventId: convexEventId } : 'skip'
  );
  const currentUserId = useQuery(api.users.getMyId) ?? undefined;

  const permCommunityId = eventDoc?.communityId;
  const communityRecord = useQuery(
    api.communities.getById,
    permCommunityId ? { communityId: permCommunityId } : 'skip'
  );
  const communityMembersResult = useQuery(
    api.communities.getCommunityMembers,
    permCommunityId ? { communityId: permCommunityId } : 'skip'
  );

  const displayEvent =
    eventDoc && eventDoc !== null
      ? {
          id: eventDoc._id,
          title: eventDoc.title,
          timeLabel: formatDateTimeLabel(
            eventDoc.startTime,
            eventDoc.endTime,
            eventDoc.allDay
          ),
          dateTimeParts: formatDateTimeParts(
            eventDoc.startTime,
            eventDoc.endTime,
            eventDoc.allDay
          ),
          groupName: event?.groupName,
          location: eventDoc.location,
          description: eventDoc.description,
          isRecurring: eventDoc.isRecurring,
          recurringPattern: eventDoc.recurringPattern,
          reminders: (eventDoc as { reminders?: number[] }).reminders,
          attachments: (eventDoc.attachments ?? []) as Attachment[],
          participants: eventDoc.participants ?? [],
          requiresRsvp: eventDoc.requiresRsvp,
          startTime: eventDoc.startTime,
          allDay: eventDoc.allDay,
          communityId: eventDoc.communityId,
          createdBy: eventDoc.createdBy,
          status: eventDoc.status,
          cancelledAt: eventDoc.cancelledAt,
          cancelReason: eventDoc.cancelReason,
          isSavedToMyCalendar: eventDoc.isSavedToMyCalendar === true,
        }
      : event
        ? {
            id: event.id,
            title: event.title,
            timeLabel: event.allDay
              ? 'כל היום'
              : event.endTime
                ? `${event.time}-${event.endTime}`
                : event.time,
            groupName: event.groupName,
            location: event.location,
            description: event.description,
            isRecurring: event.isRecurring,
            recurringPattern: event.recurringPattern,
            reminders: event.reminders,
            attachments: [] as Attachment[],
            participants: [],
            requiresRsvp: false,
            startTime: undefined,
            allDay: event.allDay,
            communityId: event.communityId,
            createdBy: undefined,
            status: undefined,
            cancelledAt: undefined,
            cancelReason: undefined,
            isSavedToMyCalendar: event.isSavedToMyCalendar === true,
          }
        : null;

  const handleEdit = (): void => {
    if (!displayEvent) return;
    onClose();
    router.push({
      pathname: '/(authenticated)/event-edit/[id]',
      params: {
        id: displayEvent.id,
        ...(displayEvent.communityId
          ? { returnCommunityId: displayEvent.communityId as string }
          : {}),
      },
    });
  };

  const handleShare = (): void => {
    if (!displayEvent) return;
    const doShare = async (): Promise<void> => {
      const lines = [displayEvent.title];
      if (displayEvent.startTime) {
        let dateLine = new Date(displayEvent.startTime).toLocaleDateString(
          'he-IL',
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
        );
        if (!displayEvent.allDay) {
          dateLine += ` · ${formatTime(displayEvent.startTime)}`;
        }
        lines.push(dateLine);
      } else if (displayEvent.timeLabel) {
        lines.push(displayEvent.timeLabel);
      }
      if (displayEvent.location) lines.push(`מיקום: ${displayEvent.location}`);
      const shareText = lines.join('\n');

      if (!displayEvent.communityId && convexEventId) {
        try {
          const { token } = await createShareLinkMutation({
            eventId: convexEventId,
          });
          await Share.share({
            message: `${shareText}\n\nhttps://inyomi.com/shared/${token}`,
          });
          return;
        } catch {
          // Fallback to text-only share below.
        }
      }

      await Share.share({ message: shareText });
    };

    doShare().catch(() => Alert.alert('שגיאה', 'לא ניתן לשתף כרגע'));
  };

  const handleCancel = (): void => {
    if (!convexEventId || !currentUserId) return;
    const isCommunity = Boolean(displayEvent?.communityId);
    const message = isCommunity
      ? 'האירוע יוצג בקהילה כמבוטל למשך 24 שעות, כדי שחברי הקהילה יראו את העדכון.'
      : 'האם לבטל את האירוע?';
    Alert.alert('ביטול אירוע', message, [
      { text: 'חזרה', style: 'cancel' },
      {
        text: 'בטל אירוע',
        style: 'destructive',
        onPress: () => {
          cancelEventMutation({
            eventId: convexEventId,
            cancelledBy: currentUserId,
          })
            .then(() => onClose())
            .catch(() => Alert.alert('שגיאה', 'לא ניתן לבטל את האירוע'));
        },
      },
    ]);
  };

  const handleDelete = (): void => {
    if (!convexEventId) return;
    Alert.alert(
      'הסרת אירוע',
      'האם למחוק את האירוע לגמרי מהקהילה? פעולה זו תסיר אותו מהתצוגה לכל חברי הקהילה.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'הסר לגמרי',
          style: 'destructive',
          onPress: () => {
            deleteEventMutation({ eventId: convexEventId })
              .then(() => onClose())
              .catch(() => Alert.alert('שגיאה', 'לא ניתן למחוק את האירוע'));
          },
        },
      ]
    );
  };

  const handleNavigate = (): void => {
    const location = displayEvent?.location?.trim();
    if (!location) return;
    setNavPickerOpen(true);
  };

  const openNavigationUrl = (app: 'google' | 'waze'): void => {
    const location = displayEvent?.location?.trim();
    if (!location) return;
    const encoded = encodeURIComponent(location);
    const url =
      app === 'google'
        ? `https://www.google.com/maps/search/?api=1&query=${encoded}`
        : `https://waze.com/ul?q=${encoded}&navigate=yes`;
    setNavPickerOpen(false);
    Linking.openURL(url).catch(() =>
      Alert.alert('שגיאה', 'לא ניתן לפתוח ניווט כרגע')
    );
  };

  if (!visible || (!displayEvent && !convexEventId)) return null;

  const isLoading = convexEventId && eventDoc === undefined;
  const isNotFound = convexEventId && eventDoc === null;
  const hasLocation = Boolean(displayEvent?.location?.trim());
  const recurrenceLabel =
    displayEvent?.isRecurring === true
      ? formatRecurrenceLabel(displayEvent.recurringPattern)
      : 'ללא';
  const reminderLabels = (displayEvent?.reminders ?? [])
    .filter((r): r is number => typeof r === 'number')
    .map(formatReminderLabel);
  const tasks = eventTasks ?? [];
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, 2);
  const rsvpRows = rsvps ?? [];
  const yesCount = rsvpRows.filter((r) => r.status === 'yes').length;
  const maybeCount = rsvpRows.filter((r) => r.status === 'maybe').length;
  const noCount = rsvpRows.filter((r) => r.status === 'no').length;
  const isOpenCommunityEvent =
    Boolean(displayEvent?.communityId) && displayEvent?.requiresRsvp === false;

  const hasCommunityResponseSummary = Boolean(
    !isOpenCommunityEvent && (displayEvent?.requiresRsvp || rsvpRows.length > 0)
  );
  const hasManualParticipantNames =
    (displayEvent?.participants?.length ?? 0) > 0;

  const myMembership = communityMembersResult?.members?.find(
    (m) => m.userId === currentUserId
  );
  const isEventCreator =
    Boolean(displayEvent?.createdBy && currentUserId) &&
    displayEvent?.createdBy === currentUserId;
  const isCommunityOwnerOrAdmin =
    myMembership?.role === 'owner' || myMembership?.role === 'admin';
  const canManageCommunityEvent =
    Boolean(displayEvent?.communityId) &&
    (isEventCreator || isCommunityOwnerOrAdmin);

  const canEdit = displayEvent?.communityId
    ? canManageCommunityEvent
    : Boolean(
        convexEventId &&
          displayEvent?.createdBy &&
          currentUserId &&
          displayEvent.createdBy === currentUserId
      );

  const canCancel = displayEvent?.communityId
    ? Boolean(
        convexEventId &&
          canManageCommunityEvent &&
          displayEvent.status !== 'cancelled'
      )
    : Boolean(
        convexEventId && isEventCreator && displayEvent?.status !== 'cancelled'
      );

  const canDelete = Boolean(
    convexEventId &&
      displayEvent?.status === 'cancelled' &&
      displayEvent.cancelledAt !== undefined &&
      Date.now() - (displayEvent.cancelledAt as number) < 24 * 60 * 60 * 1000 &&
      (displayEvent.communityId ? canManageCommunityEvent : isEventCreator)
  );

  /** Owner/admin/creator: no RSVP prompt on community events — mirror event/[id].tsx */
  const skipCommunityRsvpPrompt =
    isEventCreator ||
    (Boolean(displayEvent?.communityId) && isCommunityOwnerOrAdmin);

  const myRsvpRow = rsvpRows.find((r) => r.userId === currentUserId);
  const rawRsvp = myRsvpRow?.status;
  const currentRsvpStatus: 'yes' | 'no' | 'maybe' | 'none' =
    rawRsvp === 'yes' || rawRsvp === 'maybe' || rawRsvp === 'no'
      ? rawRsvp
      : 'none';

  const rsvpHelperText = getBottomSheetRsvpHelperText(currentRsvpStatus);

  const showMemberRsvp = Boolean(
    !skipCommunityRsvpPrompt && displayEvent?.communityId
  );

  const showMemberRsvpButtons = Boolean(
    showMemberRsvp && !isOpenCommunityEvent
  );

  const openCommunityCalendarInfoReady =
    !displayEvent?.communityId ||
    (communityRecord !== undefined && communityMembersResult !== undefined);

  const viewerIsActiveCommunityMemberForCalendar =
    communityMembersResult !== undefined && communityMembersResult !== null;

  /** Personal calendar toggle — same rules as community flyer; not gated on RSVP/banner/skip. */
  const showOpenCalendarButton = Boolean(
    openCommunityCalendarInfoReady &&
      isOpenCommunityCalendarActionVisible({
        event: {
          communityId: displayEvent?.communityId ?? null,
          requiresRsvp: displayEvent?.requiresRsvp,
          status: displayEvent?.status,
        },
        hasValidConvexEventId: Boolean(convexEventId),
        communityArchived: communityRecord?.archived === true,
        viewerIsActiveMember: viewerIsActiveCommunityMemberForCalendar,
      })
  );

  /** Event mode label — all active members including creator/admin (not gated on RSVP skip). */
  const showOpenCommunityLabel = Boolean(
    openCommunityCalendarInfoReady &&
      displayEvent &&
      isOpenCommunityInformationalLabelVisible({
        event: {
          communityId: displayEvent.communityId ?? null,
          requiresRsvp: displayEvent.requiresRsvp,
          status: displayEvent.status,
        },
        communityArchived: communityRecord?.archived === true,
        viewerIsActiveMember: viewerIsActiveCommunityMemberForCalendar,
      })
  );

  const showRsvpUnifiedCard = Boolean(
    convexEventId &&
      (showMemberRsvpButtons ||
        hasCommunityResponseSummary ||
        hasManualParticipantNames)
  );

  /**
   * Footer state must track Convex `eventDoc` when loaded — avoids mismatched
   * Pressable vs Text styles during query refresh (white-on-white) and keeps
   * label + colors in sync after add/remove mutations.
   */
  const openCalendarFooterSaved =
    convexEventId && eventDoc !== undefined && eventDoc !== null
      ? eventDoc.isSavedToMyCalendar === true
      : displayEvent?.isSavedToMyCalendar === true;

  return (
    <Modal
      animationType="slide"
      onRequestClose={handleRequestClose}
      transparent
      visible={visible}
    >
      <Pressable onPress={handleRequestClose} style={styles.backdrop} />

      <Animated.View
        pointerEvents={isClosingState ? 'none' : 'box-none'}
        style={[
          styles.sheet,
          {
            transform: [{ translateY: sheetTranslateY }],
          },
        ]}
      >
        <View
          collapsable={false}
          style={styles.handleTouch}
          {...handlePanResponder.panHandlers}
        >
          <View style={styles.handle} />
        </View>

        <View
          pointerEvents="box-none"
          style={[
            styles.sheetCloseBar,
            { paddingLeft: insets.left + 14, paddingRight: 14 },
          ]}
        >
          <Pressable
            accessibilityLabel="סגירת פרטי האירוע"
            accessibilityRole="button"
            accessible={true}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={handleRequestClose}
            style={({ pressed }) => [
              styles.sheetCloseHit,
              pressed && styles.sheetCloseHitPressed,
            ]}
          >
            <MaterialIcons color="#64748b" name="close" size={24} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color="#36a9e2" size="large" />
          </View>
        ) : isNotFound || !displayEvent ? (
          <View style={styles.loadingState}>
            <MaterialIcons color="#d1d5db" name="error-outline" size={36} />
            <Text style={styles.emptyText}>אירוע לא נמצא</Text>
          </View>
        ) : (
          <View style={styles.sheetMainColumn}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="always"
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={styles.scrollArea}
            >
              {displayEvent.status === 'cancelled' ? (
                <View style={styles.cancelledBadge}>
                  <Text style={styles.cancelledBadgeText}>אירוע בוטל</Text>
                  {displayEvent.cancelReason ? (
                    <Text style={styles.cancelReason}>
                      {displayEvent.cancelReason}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.heroCard}>
                <Text style={styles.sheetTitle}>{displayEvent.title}</Text>
                {displayEvent.groupName ? (
                  <Text style={styles.groupLabel}>
                    {displayEvent.groupName}
                  </Text>
                ) : null}
                <View style={styles.infoRow}>
                  <MaterialIcons color="#94a3b8" name="schedule" size={17} />
                  <View style={styles.dateTimeBlock}>
                    <Text style={styles.dateLine}>
                      {displayEvent.dateTimeParts
                        ? displayEvent.dateTimeParts.dateLine
                        : displayEvent.timeLabel}
                    </Text>
                    {displayEvent.dateTimeParts ? (
                      <Text style={styles.timeText}>
                        {displayEvent.dateTimeParts.timeLine}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {hasLocation ? (
                  <View style={styles.locationRowLtrShell}>
                    <View style={styles.locationRow}>
                      <Pressable
                        accessibilityLabel={`נווט אל ${displayEvent.location}`}
                        accessibilityRole="button"
                        accessible={true}
                        onPress={handleNavigate}
                        style={styles.navigateBtn}
                      >
                        <MaterialIcons color="#fff" name="near-me" size={14} />
                        <Text style={styles.navigateBtnText}>נווט</Text>
                      </Pressable>
                      <View style={styles.locationTextBlock}>
                        <MaterialIcons
                          color="#94a3b8"
                          name="location-on"
                          size={17}
                        />
                        <Text numberOfLines={1} style={styles.locationText}>
                          {displayEvent.location}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {showOpenCommunityLabel ? (
                  <View style={styles.openCommunityHeroInfo}>
                    <MaterialIcons color="#64748b" name="groups" size={18} />
                    <Text style={styles.openCommunityHeroInfoText}>
                      פתוח לחברי הקהילה
                    </Text>
                  </View>
                ) : null}

                <View style={styles.quickActionsLtrRow}>
                  <QuickAction
                    color="#dc2626"
                    disabled={!canCancel}
                    icon="event-busy"
                    label="ביטול"
                    onPress={handleCancel}
                  />
                  <QuickAction
                    color="#2563eb"
                    disabled={false}
                    icon="share"
                    label="שיתוף"
                    onPress={handleShare}
                  />
                  <QuickAction
                    color="#36a9e2"
                    disabled={!canEdit}
                    icon="edit"
                    label="עריכה"
                    onPress={handleEdit}
                  />
                </View>

                {canDelete ? (
                  <Pressable
                    accessible={true}
                    accessibilityLabel="הסר אירוע מהקהילה"
                    accessibilityRole="button"
                    onPress={handleDelete}
                    style={styles.deleteEventBtn}
                  >
                    <MaterialIcons
                      color="#dc2626"
                      name="delete-forever"
                      size={18}
                    />
                    <Text style={styles.deleteEventBtnText}>
                      הסר אירוע מהקהילה
                    </Text>
                  </Pressable>
                ) : null}

                {displayEvent.description ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesLabel}>הערות</Text>
                    <Text style={styles.notesText}>
                      {displayEvent.description}
                    </Text>
                  </View>
                ) : null}
              </View>

              {showRsvpUnifiedCard ? (
                <View style={[styles.sectionCard, styles.rsvpMemberCard]}>
                  {showMemberRsvpButtons ? (
                    <>
                      <Text style={styles.rsvpMemberTitle}>האם תשתתף/י?</Text>
                      <View style={styles.rsvpMemberButtonRow}>
                        {MEMBER_RSVP_OPTIONS.map((opt) => {
                          const isActive = currentRsvpStatus === opt.status;
                          const rsvpDisabled =
                            displayEvent.status === 'cancelled';
                          return (
                            <View
                              key={opt.status}
                              collapsable={false}
                              style={[
                                styles.rsvpMemberBtnShell,
                                isActive && styles.rsvpMemberBtnShellSelected,
                                {
                                  backgroundColor: isActive
                                    ? opt.selectedBg
                                    : RSVP_BTN_BG_IDLE,
                                  borderColor: isActive
                                    ? opt.selectedBorder
                                    : RSVP_BTN_BORDER_IDLE,
                                  borderWidth: isActive ? 3 : 2,
                                  elevation: isActive ? 5 : 3,
                                  shadowOpacity: isActive ? 0.16 : 0.12,
                                  opacity: rsvpDisabled ? 0.48 : 1,
                                },
                              ]}
                            >
                              <Pressable
                                accessibilityHint={
                                  rsvpDisabled
                                    ? undefined
                                    : 'מגדיר את תגובת ההגעה שלך לאירוע'
                                }
                                accessibilityLabel={opt.label}
                                accessibilityRole="button"
                                accessibilityState={{
                                  disabled: rsvpDisabled,
                                  selected: isActive,
                                }}
                                accessible={true}
                                disabled={rsvpDisabled}
                                hitSlop={{
                                  top: 6,
                                  bottom: 6,
                                  left: 6,
                                  right: 6,
                                }}
                                onPress={() => handleRsvp(opt.status)}
                                style={({ pressed }) => [
                                  styles.rsvpMemberBtnPressable,
                                  pressed &&
                                    !rsvpDisabled && {
                                      backgroundColor: isActive
                                        ? 'rgba(0,0,0,0.06)'
                                        : 'rgba(15,23,42,0.08)',
                                    },
                                ]}
                              >
                                <View
                                  pointerEvents="none"
                                  style={styles.rsvpMemberBtnContent}
                                >
                                  <Text
                                    pointerEvents="none"
                                    style={[
                                      styles.rsvpMemberBtnText,
                                      isActive &&
                                        styles.rsvpMemberBtnTextSelected,
                                      isActive && { color: opt.selectedText },
                                    ]}
                                  >
                                    {opt.label}
                                  </Text>
                                  {isActive ? (
                                    <MaterialIcons
                                      accessibilityElementsHidden={true}
                                      color={opt.selectedText}
                                      importantForAccessibility="no-hide-descendants"
                                      name="check"
                                      pointerEvents="none"
                                      size={18}
                                    />
                                  ) : null}
                                </View>
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      {rsvpHelperText ? (
                        <Text style={styles.rsvpMemberHelper}>
                          {rsvpHelperText}
                        </Text>
                      ) : currentRsvpStatus === 'none' &&
                        displayEvent.status !== 'cancelled' ? (
                        <Text style={styles.rsvpMemberHint}>
                          בחר/י את תגובתך
                        </Text>
                      ) : null}
                    </>
                  ) : null}

                  {showMemberRsvpButtons &&
                  (hasCommunityResponseSummary || hasManualParticipantNames) ? (
                    <View style={styles.rsvpUnifiedDivider} />
                  ) : null}

                  {hasCommunityResponseSummary ? (
                    <Pressable
                      accessibilityHint="פותח רשימת משתתפים לפי סוג תגובה"
                      accessibilityLabel={`תגובות משתתפים, כן ${yesCount}, אולי ${maybeCount}, לא ${noCount}. צפייה`}
                      accessibilityRole="button"
                      accessible={true}
                      onPress={() => setParticipantRsvpDetailsOpen(true)}
                      style={({ pressed }) => [
                        styles.rsvpCommunitySummaryBtn,
                        pressed && styles.rsvpCommunitySummaryBtnPressed,
                      ]}
                    >
                      <Text style={styles.rsvpCommunitySummarySectionTitle}>
                        תגובות משתתפים
                      </Text>
                      <View style={styles.rsvpCommunitySummaryRow}>
                        <Text style={styles.rsvpCommunitySummaryCounts}>
                          {`כן ${yesCount} · אולי ${maybeCount} · לא ${noCount}`}
                        </Text>
                        <MaterialIcons
                          color="#94a3b8"
                          name="chevron-left"
                          size={22}
                        />
                      </View>
                      <Text style={styles.rsvpCommunitySummaryViewHint}>
                        צפייה
                      </Text>
                    </Pressable>
                  ) : null}

                  {hasCommunityResponseSummary && hasManualParticipantNames ? (
                    <View style={styles.rsvpUnifiedDivider} />
                  ) : null}

                  {!hasCommunityResponseSummary &&
                  showMemberRsvpButtons &&
                  hasManualParticipantNames ? (
                    <View style={styles.rsvpUnifiedDivider} />
                  ) : null}

                  {hasManualParticipantNames ? (
                    <View style={styles.rsvpManualParticipantsBlock}>
                      <Text style={styles.rsvpManualParticipantsTitle}>
                        מוזמנים (מהאירוע)
                      </Text>
                      <View style={styles.participantsWrap}>
                        {displayEvent.participants.map((name) => (
                          <View key={name} style={styles.participantPill}>
                            <Text style={styles.participantPillText}>
                              {name}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>תזמון</Text>
                <View style={styles.scheduleRow}>
                  <MaterialIcons color="#36a9e2" name="repeat" size={18} />
                  <Text style={styles.scheduleText}>
                    {`אירוע חוזר: ${recurrenceLabel}`}
                  </Text>
                </View>
                {reminderLabels.length > 0 ? (
                  <View style={styles.reminderRows}>
                    {reminderLabels.map((label) => (
                      <View key={label} style={styles.reminderDisplayRow}>
                        <MaterialIcons
                          color="#36a9e2"
                          name="notifications-none"
                          size={16}
                        />
                        <Text style={styles.reminderDisplayText}>{label}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>

              {convexEventId ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>משימות לאירוע</Text>
                  {eventTasks === undefined ? (
                    <Text style={styles.mutedText}>טוען משימות...</Text>
                  ) : tasks.length > 0 ? (
                    <View style={styles.compactList}>
                      {visibleTasks.map((task) => {
                        const assigneeDisplay = (
                          task as { assigneeDisplay?: string }
                        ).assigneeDisplay?.trim();
                        return (
                          <View key={task._id} style={styles.detailListRow}>
                            <MaterialIcons
                              color="#36a9e2"
                              name="checklist"
                              size={16}
                            />
                            <View style={styles.detailListContent}>
                              <Text style={styles.detailListTitle}>
                                {task.title}
                              </Text>
                              <Text style={styles.mutedText}>
                                {assigneeDisplay
                                  ? `הוקצה ל-${assigneeDisplay}`
                                  : 'לא הוקצה'}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      {tasks.length > 2 ? (
                        <Pressable
                          accessibilityLabel={
                            showAllTasks ? 'הצג פחות משימות' : 'הצג עוד משימות'
                          }
                          accessibilityRole="button"
                          accessible={true}
                          onPress={() => setShowAllTasks((value) => !value)}
                          style={styles.showMoreBtn}
                        >
                          <Text style={styles.showMoreText}>
                            {showAllTasks
                              ? 'הצג פחות משימות'
                              : 'הצג עוד משימות'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : (
                    <Text style={styles.mutedText}>
                      לא נוספו משימות לאירוע הזה
                    </Text>
                  )}
                </View>
              ) : null}

              {displayEvent.attachments.length > 0 ? (
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>קבצים מצורפים</Text>
                  <View style={styles.compactList}>
                    {displayEvent.attachments.map((attachment) => (
                      <AttachmentRow
                        attachment={attachment}
                        key={String(attachment.storageId)}
                        onPreviewImage={setPreviewImageUrl}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </ScrollView>

            <SafeAreaView edges={['bottom']} style={styles.sheetFooterSafe}>
              {showOpenCalendarButton ? (
                <View style={styles.openCalendarFooter}>
                  <Pressable
                    accessibilityHint="מוסיף או מסיר את האירוע מהיומן האישי שלך"
                    accessibilityLabel={getOpenCommunityCalendarActionLabel(
                      openCalendarFooterSaved
                    )}
                    accessibilityRole="button"
                    accessible={true}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={handleOpenCalendarToggle}
                    style={({ pressed }) => ({
                      alignSelf: 'stretch' as const,
                      opacity: pressed ? 0.9 : 1,
                    })}
                  >
                    <View
                      style={{
                        alignSelf: 'stretch',
                        minHeight: 48,
                        paddingVertical: 14,
                        paddingHorizontal: 16,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: openCalendarFooterSaved
                          ? '#ffffff'
                          : '#36a9e2',
                        borderWidth: openCalendarFooterSaved ? 2 : 0,
                        borderColor: '#7dd3fc',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: '700',
                          textAlign: 'center',
                          color: openCalendarFooterSaved
                            ? '#0369a1'
                            : '#ffffff',
                        }}
                      >
                        {getOpenCommunityCalendarActionLabel(
                          openCalendarFooterSaved
                        )}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </SafeAreaView>
          </View>
        )}
      </Animated.View>

      <Modal
        animationType="fade"
        onRequestClose={() => setNavPickerOpen(false)}
        transparent
        visible={navPickerOpen}
      >
        <Pressable
          onPress={() => setNavPickerOpen(false)}
          style={styles.navPickerBackdrop}
        />
        <View style={styles.navPickerSheet}>
          <Text style={styles.navPickerTitle}>פתיחה בניווט</Text>
          <Pressable
            accessibilityLabel="פתח ב-Google Maps"
            accessibilityRole="button"
            accessible={true}
            onPress={() => openNavigationUrl('google')}
            style={styles.navOption}
          >
            <Image
              resizeMode="contain"
              source={googleMapsIcon}
              style={styles.navAppIcon}
            />
            <Text style={styles.navOptionText}>Google Maps</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="פתח ב-Waze"
            accessibilityRole="button"
            accessible={true}
            onPress={() => openNavigationUrl('waze')}
            style={styles.navOption}
          >
            <Image
              resizeMode="contain"
              source={wazeIcon}
              style={styles.navAppIcon}
            />
            <Text style={styles.navOptionText}>Waze</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="ביטול"
            accessibilityRole="button"
            accessible={true}
            onPress={() => setNavPickerOpen(false)}
            style={styles.navCancel}
          >
            <Text style={styles.navCancelText}>ביטול</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
        transparent
        visible={previewImageUrl !== null}
      >
        <View style={styles.previewBackdrop}>
          <Pressable
            accessibilityLabel="סגור תצוגת תמונה"
            accessibilityRole="button"
            accessible={true}
            onPress={() => setPreviewImageUrl(null)}
            style={styles.previewCloseIcon}
          >
            <MaterialIcons color="#fff" name="close" size={24} />
          </Pressable>
          {previewImageUrl ? (
            <Image
              resizeMode="contain"
              source={{ uri: previewImageUrl }}
              style={styles.previewImage}
            />
          ) : null}
          <Pressable
            accessibilityLabel="סגירת תצוגה מקדימה"
            accessibilityRole="button"
            accessible={true}
            onPress={() => setPreviewImageUrl(null)}
            style={styles.previewCloseBtn}
          >
            <Text style={styles.previewCloseText}>סגירה</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setParticipantRsvpDetailsOpen(false)}
        transparent
        visible={participantRsvpDetailsOpen}
      >
        <Pressable
          accessibilityLabel="סגור"
          accessibilityRole="button"
          accessible={true}
          onPress={() => setParticipantRsvpDetailsOpen(false)}
          style={styles.rsvpDetailModalBackdrop}
        />
        <View
          style={[
            styles.rsvpDetailModalSheet,
            { maxHeight: RSVP_DETAIL_MODAL_MAX_HEIGHT },
          ]}
        >
          <Text style={styles.rsvpDetailModalTitle}>תגובות משתתפים</Text>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={[
              styles.rsvpDetailScroll,
              { maxHeight: RSVP_DETAIL_SCROLL_MAX_HEIGHT },
            ]}
            contentContainerStyle={styles.rsvpDetailScrollContent}
          >
            <View style={styles.rsvpDetailGroup}>
              <Text
                style={styles.rsvpDetailGroupTitle}
              >{`כן (${yesCount})`}</Text>
              {rsvpRows.filter((r) => r.status === 'yes').length === 0 ? (
                <Text style={styles.rsvpDetailEmpty}>אין עדיין</Text>
              ) : (
                rsvpRows
                  .filter((r) => r.status === 'yes')
                  .map((r) => (
                    <Text key={r._id} style={styles.rsvpDetailName}>
                      {rsvpRowDisplayName(r)}
                    </Text>
                  ))
              )}
            </View>
            <View style={styles.rsvpDetailGroup}>
              <Text
                style={styles.rsvpDetailGroupTitle}
              >{`אולי (${maybeCount})`}</Text>
              {rsvpRows.filter((r) => r.status === 'maybe').length === 0 ? (
                <Text style={styles.rsvpDetailEmpty}>אין עדיין</Text>
              ) : (
                rsvpRows
                  .filter((r) => r.status === 'maybe')
                  .map((r) => (
                    <Text key={r._id} style={styles.rsvpDetailName}>
                      {rsvpRowDisplayName(r)}
                    </Text>
                  ))
              )}
            </View>
            <View style={styles.rsvpDetailGroup}>
              <Text
                style={styles.rsvpDetailGroupTitle}
              >{`לא (${noCount})`}</Text>
              {rsvpRows.filter((r) => r.status === 'no').length === 0 ? (
                <Text style={styles.rsvpDetailEmpty}>אין עדיין</Text>
              ) : (
                rsvpRows
                  .filter((r) => r.status === 'no')
                  .map((r) => (
                    <Text key={r._id} style={styles.rsvpDetailName}>
                      {rsvpRowDisplayName(r)}
                    </Text>
                  ))
              )}
            </View>
          </ScrollView>
          <Pressable
            accessibilityLabel="סגירת רשימת משתתפים"
            accessibilityRole="button"
            accessible={true}
            onPress={() => setParticipantRsvpDetailsOpen(false)}
            style={styles.rsvpDetailCloseBtn}
          >
            <Text style={styles.rsvpDetailCloseBtnText}>סגירה</Text>
          </Pressable>
        </View>
      </Modal>
    </Modal>
  );
}

function QuickAction({
  color,
  disabled,
  icon,
  label,
  onPress,
}: {
  color: string;
  disabled: boolean;
  icon: ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessible={true}
      onPress={disabled ? undefined : onPress}
      style={styles.quickAction}
    >
      <View
        style={[
          styles.quickActionIcon,
          { backgroundColor: `${color}18` },
          disabled && styles.quickActionDisabled,
        ]}
      >
        <MaterialIcons
          color={disabled ? '#cbd5e1' : color}
          name={icon}
          size={20}
        />
      </View>
      <Text style={[styles.quickActionLabel, disabled && styles.disabledText]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AttachmentRow({
  attachment,
  onPreviewImage,
}: {
  attachment: Attachment;
  onPreviewImage: (url: string) => void;
}): React.JSX.Element {
  const fileUrl = useQuery(api.events.getAttachmentUrl, {
    storageId: attachment.storageId,
  });
  const isImage = attachment.mimeType.startsWith('image/');

  const previewFile = (): void => {
    if (!fileUrl) {
      Alert.alert('קובץ מצורף', 'הקובץ עדיין לא זמין לפתיחה');
      return;
    }
    if (isImage) {
      onPreviewImage(fileUrl);
      return;
    }
    Alert.alert('קובץ מצורף', 'לא ניתן להציג את הקובץ באפליקציה');
  };

  const downloadFile = (): void => {
    if (!fileUrl) {
      Alert.alert('קובץ מצורף', 'הקובץ עדיין לא זמין להורדה');
      return;
    }
    Linking.openURL(fileUrl).catch(() =>
      Alert.alert('שגיאה', 'לא ניתן לפתוח את הקובץ')
    );
  };

  return (
    <View style={styles.attachmentCard}>
      {isImage && fileUrl ? (
        <Image
          accessibilityLabel={attachment.displayName || attachment.originalName}
          resizeMode="cover"
          source={{ uri: fileUrl }}
          style={styles.attachmentThumb}
        />
      ) : (
        <View style={styles.attachmentIconBox}>
          <MaterialIcons
            color="#36a9e2"
            name={isImage ? 'image' : 'insert-drive-file'}
            size={18}
          />
        </View>
      )}
      <View style={styles.detailListContent}>
        <Text numberOfLines={1} style={styles.detailListTitle}>
          {attachment.displayName || attachment.originalName}
        </Text>
        <Text style={styles.mutedText}>
          {[attachment.mimeType, formatFileSize(attachment.sizeBytes)]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.attachmentActions}>
          <Pressable
            accessibilityLabel="צפייה בקובץ"
            accessibilityRole="button"
            accessible={true}
            onPress={previewFile}
            style={styles.smallActionBtn}
          >
            <Text style={styles.smallActionText}>צפייה</Text>
          </Pressable>
          {fileUrl ? (
            <Pressable
              accessibilityLabel="הורדת קובץ"
              accessibilityRole="button"
              accessible={true}
              onPress={downloadFile}
              style={styles.smallActionBtn}
            >
              <Text style={styles.smallActionText}>הורדה</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    maxHeight: screenHeight * 0.95,
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Platform.select({
      android: { direction: 'rtl' as const },
      default: {},
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    alignSelf: 'center',
  },
  handleTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    marginTop: 10,
    marginBottom: 2,
  },
  /**
   * LTR קבוע — מאותת לקצה שמאלי פיזי גם כשהגיליון באנדרואיד ב־`direction: 'rtl'`.
   * ללא position absolute — נשען על padding + שורה כדי שלא יגלוש מהמסך.
   */
  sheetCloseBar: {
    width: '100%',
    minHeight: 48,
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sheetCloseHit: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
  },
  sheetCloseHitPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },
  sheetMainColumn: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 18,
  },
  scrollContent: {
    paddingBottom: 14,
    gap: 8,
    alignItems: 'stretch',
  },
  cancelledBadge: {
    alignSelf: 'stretch',
    backgroundColor: '#fee2e2',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  cancelledBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991b1b',
    textAlign: HEB_TEXT_ALIGN,
  },
  cancelReason: {
    fontSize: 13,
    color: '#7f1d1d',
    textAlign: HEB_TEXT_ALIGN,
  },
  heroCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    gap: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  sheetTitle: {
    fontSize: 23,
    fontWeight: '800',
    color: '#111517',
    textAlign: HEB_TEXT_ALIGN,
  },
  groupLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: HEB_TEXT_ALIGN,
    marginTop: -3,
  },
  infoRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 7,
  },
  dateTimeBlock: {
    flex: 1,
    gap: 1,
  },
  dateLine: {
    fontSize: 14,
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 15,
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '800',
  },
  infoText: {
    fontSize: 15,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    flex: 1,
  },
  /** מנע כפל RTL בתוך Modal — שומר נווט משמאל וטקסט מימין */
  locationRowLtrShell: {
    alignSelf: 'stretch',
    width: '100%',
    direction: 'ltr',
  },
  /** נווט משמאל, טקסט + אייקון מיקום מימין (אייקון בקצה ימין) */
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    width: '100%',
  },
  /** בתוך LTR: row-reverse + אייקון ואז טקסט → אייקון בקצה ימין, טקסט נצמד אליו */
  locationTextBlock: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    minWidth: 0,
  },
  locationText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '600',
  },
  navigateBtn: {
    backgroundColor: '#36a9e2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
  },
  navigateBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  /** LTR קבוע: ביטול משמאל · שיתוף במרכז · עריכה מימין (לא תלוי בהיפוך iOS) */
  quickActionsLtrRow: {
    direction: 'ltr',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 2,
  },
  deleteEventBtn: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
    backgroundColor: '#fff5f5',
  },
  deleteEventBtnText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
    textAlign: HEB_TEXT_ALIGN,
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
    minWidth: 66,
    minHeight: 58,
    justifyContent: 'center',
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionDisabled: {
    backgroundColor: '#f1f5f9',
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700',
    textAlign: 'center',
  },
  disabledText: {
    color: '#cbd5e1',
  },
  notesBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    gap: 2,
  },
  notesLabel: {
    fontSize: 12,
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '800',
  },
  notesText: {
    fontSize: 14,
    color: '#334155',
    textAlign: HEB_TEXT_ALIGN,
    lineHeight: 20,
    fontWeight: '600',
  },
  openCommunityHeroInfo: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  openCommunityHeroInfoText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    textAlign: HEB_TEXT_ALIGN,
  },
  sheetFooterSafe: {
    backgroundColor: '#fff',
  },
  openCalendarFooter: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  openCalendarFooterBtnPrimary: {
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#36a9e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCalendarFooterBtnTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  openCalendarFooterBtnSecondary: {
    alignSelf: 'stretch',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#7dd3fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openCalendarFooterBtnTextSecondary: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  rsvpMemberCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  rsvpMemberTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpMemberButtonRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  /**
   * View draws border/bg/shadow (reliable on Android). Pressable is a transparent flex fill;
   * no android_ripple here — ripple was hiding the visible fill on some devices.
   */
  rsvpMemberBtnShell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    minHeight: 48,
    borderRadius: 12,
    borderStyle: 'solid',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  rsvpMemberBtnShellSelected: {
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  rsvpMemberBtnPressable: {
    flex: 1,
    alignSelf: 'stretch',
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  rsvpMemberBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0.12,
  },
  rsvpMemberBtnTextSelected: {
    fontWeight: '800',
  },
  rsvpMemberHelper: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpMemberBtnContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  rsvpMemberHint: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpUnifiedDivider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  rsvpCommunitySummaryBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rsvpCommunitySummaryBtnPressed: {
    backgroundColor: '#e8f0f6',
  },
  rsvpCommunitySummarySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
    marginBottom: 4,
  },
  rsvpCommunitySummaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  rsvpCommunitySummaryCounts: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpCommunitySummaryViewHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#36a9e2',
    textAlign: HEB_TEXT_ALIGN,
    marginTop: 6,
  },
  rsvpManualParticipantsBlock: {
    gap: 8,
  },
  rsvpManualParticipantsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpDetailModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.32)',
  },
  rsvpDetailModalSheet: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 10,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  rsvpDetailModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpDetailScroll: {
    flexGrow: 0,
  },
  rsvpDetailScrollContent: {
    gap: 18,
    paddingBottom: 8,
  },
  rsvpDetailGroup: {
    gap: 6,
  },
  rsvpDetailGroupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpDetailName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    textAlign: HEB_TEXT_ALIGN,
    paddingVertical: 2,
  },
  rsvpDetailEmpty: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: HEB_TEXT_ALIGN,
  },
  rsvpDetailCloseBtn: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rsvpDetailCloseBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
  },
  sectionCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  scheduleRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 8,
  },
  scheduleText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '600',
  },
  reminderRows: {
    gap: 6,
  },
  reminderDisplayRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 3,
  },
  reminderDisplayText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    textAlign: HEB_TEXT_ALIGN,
    fontWeight: '800',
  },
  compactList: {
    gap: 8,
  },
  detailListRow: {
    flexDirection: HEB_ROW,
    alignItems: 'center',
    gap: 8,
  },
  detailListContent: {
    flex: 1,
    gap: 2,
  },
  detailListTitle: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: HEB_TEXT_ALIGN,
  },
  mutedText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: HEB_TEXT_ALIGN,
  },
  showMoreBtn: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
    minHeight: 32,
  },
  showMoreText: {
    color: '#36a9e2',
    fontWeight: '700',
    fontSize: 13,
  },
  participantsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  participantPill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  participantPillText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  attachmentCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 8,
  },
  attachmentThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
  },
  attachmentIconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#e8f5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  smallActionBtn: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#e8f5fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionText: {
    color: '#36a9e2',
    fontSize: 12,
    fontWeight: '700',
  },
  navPickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.28)',
  },
  navPickerSheet: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 14,
    gap: 8,
  },
  navPickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
    textAlign: HEB_TEXT_ALIGN,
    marginBottom: 2,
  },
  navOption: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  navAppIcon: {
    width: 28,
    height: 28,
  },
  navOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    textAlign: HEB_TEXT_ALIGN,
  },
  navCancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  navCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748b',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  previewImage: {
    width: '100%',
    height: '72%',
  },
  previewCloseIcon: {
    position: 'absolute',
    top: 56,
    left: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  previewCloseText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '800',
  },
});

function isValidConvexId(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.length >= 8;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTimeLabel(
  startTime: number,
  endTime: number,
  allDay?: boolean
): string {
  const { dateLine, timeLine } = formatDateTimeParts(
    startTime,
    endTime,
    allDay
  );
  return `${dateLine}\n${timeLine}`;
}

function formatDateTimeParts(
  startTime: number,
  endTime: number,
  allDay?: boolean
): { dateLine: string; timeLine: string } {
  const dateLine = new Date(startTime).toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const timeLine = allDay
    ? 'כל היום'
    : `${formatTime(startTime)}-${formatTime(endTime)}`;
  return { dateLine, timeLine };
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes <= 0) return '';
  if (sizeBytes < 1024 * 1024) {
    return `${Math.round(sizeBytes / 1024)}KB`;
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatRecurrenceLabel(pattern: string | undefined): string {
  if (pattern === 'daily') return 'כל יום';
  if (pattern === 'weekly') return 'כל שבוע';
  if (pattern === 'monthly') return 'כל חודש';
  if (pattern === 'yearly') return 'כל שנה';
  if (pattern === 'custom') return 'מותאם אישית';
  return 'ללא';
}

function formatReminderLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return 'תזכורת: בזמן האירוע';
  if (offsetMinutes === 60) return 'תזכורת: שעה לפני האירוע';
  if (offsetMinutes === 1440) return 'תזכורת: 24 שעות לפני האירוע';
  if (offsetMinutes % 1440 === 0) {
    return `תזכורת: ${offsetMinutes / 1440} ימים לפני האירוע`;
  }
  if (offsetMinutes % 60 === 0) {
    return `תזכורת: ${offsetMinutes / 60} שעות לפני האירוע`;
  }
  return `תזכורת: ${offsetMinutes} דקות לפני האירוע`;
}
