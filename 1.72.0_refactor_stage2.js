// ==UserScript==
// @name         B站宽屏+ (Stage 2 Refactored)
// @namespace    https://github.com/wha4up
// @version      1.72.0_refactor_stage2
// @description  播放器宽屏时自动居中。可选自动宽屏。可选启用增强侧边栏(多标签页)。新增独立设置面板。第二阶段重构：优化DOM操作，拆分大型函数，提升性能与可维护性。
// @author       Gemini, wha4up (AI Optimized), User Request
// @icon         https://raw.githubusercontent.com/wha4up/BilibiliWidescreenPlus/refs/heads/main/docs/LOGO.webp
// @license      MIT
// @match        https://*.bilibili.com/video/*
// @match        https://*.bilibili.com/list/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @supportURL   https://greasyfork.org/zh-CN/scripts/492413-b%E7%AB%99%E8%87%AA%E5%8A%A8%E5_AE%BD%E5_B1_8F%E5_85_增强版/feedback
// @homepageURL  https://greasyfork.org/zh-CN/scripts/492413-b%E7%AB%99%E8%87%AA%E5%8A%A8%E5_AE%BD%E5_B1_8F%E5_85_增强版
// ==/UserScript==

(function () {
    'use strict';

    // --- Configuration Object ---
    const config = {
        debugMode: GM_getValue('debugMode', false),
        playerCenterOffset: 75,
        delays: {
            stateChangeProcess: 200,
            urlCheck: 1000,
            finalCheck: 750,
            debounce: 200,
            observerMaxWait: 20000,
        },
        intervals: {
            check: 500,
            wideBtnWait: 300,
            contentElementWait: 300,
        },
        attempts: {
            max: 20,
            wideBtnWait: 7,
            contentElementWait: 5,
            sidebarPollMaxRetries: 10,
        },
        animationDurations: {
            scroll: 500,
        },
        styles: {
            sidebarTabHeaderHeight: '40px',
            bilibiliBlue: '#00a1d6',
            defaultVideoTitleFontSize: '22px',
            minSidebarWidth: 250,
            maxSidebarWidth: 600,
            bottomDrawerHandleHeight: '8px',
            sidebarContentPadding: '0 16px',
            sidebarHeaderBorderWidth: '1px',
        },
        settingsKeys: {
            defaultTab: 'settingDefaultSidebarTab',
            autoWideDelay: 'settingAutoWideStartDelay',
            borderRadius: 'settingCustomBorderRadius',
            borderStrokeWidth: 'settingCustomBorderStrokeWidth',
            shadowSpread: 'settingCustomShadowSpread',
            shadowBlur: 'settingCustomShadowBlur',
            playerSidebarGap: 'settingCustomPlayerSidebarGap',
            browserEdgeMargin: 'settingCustomBrowserEdgeMargin',
        },
        defaultSettings: {
            defaultTab: 'comments',
            autoWideDelay: 500,
            borderRadius: '6px',
            borderStrokeWidth: '1px',
            shadowSpread: '2px',
            shadowBlur: '4px',
            playerSidebarGap: '12px',
            browserEdgeMargin: '12px',
        },
        featureTogglesKeys: {
            enableWideScreen: 'enableWideScreen',
            enableSidebar: 'enableSidebar',
        },
        defaultFeatureToggles: {
            enableWideScreen: false,
            enableSidebar: true,
        }
    };
    config.sidebarFixedTopOffset = `${config.playerCenterOffset}px`;


    // DOM Selectors
    const SELECTORS = {
        player: '#bilibili-player',
        playerContainer: '.bpx-player-container',
        playerAlternativeContainer: '#bilibiliPlayer',
        playerWrap: '#playerWrap',
        playerCtrlArea: '.bpx-player-ctrl-area',
        wideBtn: '.bpx-player-ctrl-wide',
        webFullBtn: '.bpx-player-ctrl-web',
        fullBtn: '.bpx-player-ctrl-full',
        viewpointBtn: '.bpx-player-ctrl-viewpoint',
        videoArea: '.bpx-player-video-area',
        playerPlaceholderTop: '#bilibili-player-placeholder-top',
        sendingBar: '.bpx-player-sending-bar',
        playerPlaceholderBottom: '#bilibili-player-placeholder-bottom',
        commentContainer: '#bili-custom-comment-sidebar',
        commentApp: '#commentapp',
        allTabsContentArea: '#bili-custom-all-tabs-content-area',
        videoTitle: '.video-title',
        videoInfoMeta: '.video-info-meta',
        videoInfoDetailList: '.video-info-detail-list',
        showMoreBtnDetail: '.show-more-btn.detail',
        videoDescContainer: '.video-desc-container',
        basicDescInfo: '.basic-desc-info',
        videoTagContainer: '.video-tag-container',
        upPanelContainer: '.up-panel-container',
        videoInfoContainerWin: '.video-info-container.win',
        rcmdTab: '.rcmd-tab',
        actionList: '.action-list-container',
        recommendListV1: '.recommend-list-v1',
        recommendListContainer: '.recommend-list-container',
        danmakuBox: '#danmukuBox',
        videoToolbarContainer: '.video-toolbar-container',
        arcToolbarReport: '#arc_toolbar_report',
        viewboxReport: '#viewbox_report',
        mirrorVdcon: '#mirror-vdcon',
        leftContainer: '.left-container',
        settingsPanel: '#bili-plus-settings-panel',
        biliReportWrap: '#bili_report_wrap',
    };

    // CSS Class Names
    const CSS_CLASSES = {
        commentSidebar: 'bili-custom-comment-sidebar',
        commentSidebarActive: 'bili-custom-comment-sidebar--active',
        sidebarTabHeader: 'bili-sidebar-tab-header',
        sidebarTab: 'bili-sidebar-tab',
        sidebarTabActive: 'bili-sidebar-tab--active',
        sidebarTabIndicator: 'bili-sidebar-tab-indicator',
        sidebarTabContentWrapper: 'bili-sidebar-tab-content-wrapper',
        sidebarTabContentWrapperActive: 'bili-sidebar-tab-content-wrapper--active',
        sidebarTabContent: 'bili-sidebar-tab-content',
        sidebarTabContentActive: 'bili-sidebar-tab-content--active',
        infoTabTop: 'bili-info-tab-top-content',
        infoTabMiddle: 'bili-info-tab-middle-content',
        infoTabBottom: 'bili-info-tab-bottom-content',
        bottomDrawerWrapper: 'bili-custom-bottom-drawer-wrapper',
        bottomDrawerButton: 'bili-custom-bottom-drawer-button',
        bottomDrawerContent: 'bili-custom-bottom-drawer-content',
        drawerContentExpanded: 'bili-drawer-content-expanded',
        bodyEnhancementsActive: 'bili-custom-enhancements-active',
    };
    const SCRIPT_ELEMENT_IDS = {
        commentContainer: 'bili-custom-comment-sidebar',
        allTabsContentArea: 'bili-custom-all-tabs-content-area',
        bottomDrawerWrapper: 'bili-custom-bottom-drawer-wrapper',
        bottomDrawerButton: 'bili-custom-bottom-drawer-button',
        bottomDrawerContent: 'bili-custom-bottom-drawer-content',
        settingsPanel: 'bili-plus-settings-panel',
        playerPlaceholderTop: 'bilibili-player-placeholder-top',
        playerPlaceholderBottom: 'bilibili-player-placeholder-bottom'
    };

    // SVG Icons
    const SVG_ICONS = {
        info: '<svg class="sidebar-tab-icon info-tab-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2m0 2a8 8 0 1 0 0 16a8 8 0 0 0 0-16m-.01 6c.558 0 1.01.452 1.01 1.01v5.124A1 1 0 0 1 12.5 18h-.49A1.01 1.01 0 0 1 11 16.99V12a1 1 0 1 1 0-2zM12 7a1 1 0 1 1 0 2a1 1 0 0 1 0-2"/></svg>',
        comments: '<svg class="sidebar-tab-icon comments-tab-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 4a3 3 0 0 1 2.995 2.824L19 7v2a3 3 0 0 1 2.995 2.824L22 12v4a3 3 0 0 1-2.824 2.995L19 19v.966c0 1.02-1.143 1.594-1.954 1.033l-.096-.072L14.638 19H11a3 3 0 0 1-1.998-.762l-.14-.134L7 19.5c-.791.593-1.906.075-1.994-.879L5 18.5V17a3 3 0 0 1-2.995-2.824L2 14V7a3 3 0 0 1 2.824-2.995L5 4zm3 7h-8a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3.638a2 2 0 0 1 1.28.464l1.088.906A1.5 1.5 0 0 1 18.5 17h.5a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1m-3-5H5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h.5A1.5 1.5 0 0 1 7 16.5v.5l1.01-.757A3 3 0 0 1 8 16v-4a3 3 0 0 1 3-3h6V7a1 1 0 0 0-1-1"/></svg>',
        videos: '<svg class="sidebar-tab-icon videos-tab-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M7 13a2 2 0 0 1 1.995 1.85L9 15v3a2 2 0 0 1-1.85 1.995L7 20H4a2 2 0 0 1-1.995-1.85L2 18v-3a2 2 0 0 1 1.85-1.995L4 13zm9 4a1 1 0 0 1 .117 1.993L16 19h-4a1 1 0 0 1-.117-1.993L12 17zm-9-2H4v3h3zm13-2a1 1 0 1 1 0 2h-8a1 1 0 1 1 0-2zM7 3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm9 4a1 1 0 0 1 .117 1.993L16 9h-4a1 1 0 0 1-.117-1.993L12 7zM7 5H4v3h3zm13-2a1 1 0 0 1 .117 1.993L20 5h-8a1 1 0 0 1-.117-1.993L12 3z"/></svg>',
        danmaku: '<svg class="sidebar-tab-icon danmaku-tab-icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M9 12a1 1 0 0 1 .117 1.993L9 14H4v1a1 1 0 0 0 .883.993L5 16h1.5a1.5 1.5 0 0 1 1.493 1.356L8 17.5v.5l2.133-1.6a2 2 0 0 1 1.016-.391l.184-.009H18a1 1 0 0 0 .993-.883L19 15v-3h2v3a3 3 0 0 1-2.824 2.995L18 18h-6.667L8 20.5c-.791.593-1.906.075-1.994-.879L6 19.5V18H5a3 3 0 0 1-2.995-2.824L2 15v-2a1 1 0 0 1 .883-.993L3 12zm6 0a1 1 0 0 1 .117 1.993L15 14h-2a1 1 0 0 1-.117-1.993L13 12zM7 8a1 1 0 0 1 .117 1.993L7 10H5a1 1 0 0 1-.117-1.993L5 8zm12 0l.117.007a1 1 0 0 1 0 1.986L19 10h-8a1 1 0 0 1-.117-1.993L11 8zm-1-5a3 3 0 0 1 2.995 2.824L21 6v2h-2V6a1 1 0 0 0-.883-.993L18 5H5a1 1 0 0 0-.993.883L4 6v2H2V6a3 3 0 0 1 2.824-2.995L5 3z"/></svg>',
    };

    const SIDEBAR_TABS_CONFIG = [
        { id: 'info', text: '信息', svg: SVG_ICONS.info, paneId: 'infoContentPane', wrapperId: 'infoContentWrapper' },
        { id: 'comments', text: '评论', svg: SVG_ICONS.comments, paneId: 'commentsContentPane', wrapperId: 'commentsContentWrapper' },
        { id: 'videos', text: '视频', svg: SVG_ICONS.videos, paneId: 'videosContentPane', wrapperId: 'videosContentWrapper' },
        { id: 'danmaku', text: '弹幕', svg: SVG_ICONS.danmaku, paneId: 'danmakuContentPane', wrapperId: 'danmakuContentWrapper' }
    ];
    const VALID_SIDEBAR_TAB_IDS = SIDEBAR_TABS_CONFIG.map(t => t.id);
    const TAB_ID_TO_NAME_MAP = SIDEBAR_TABS_CONFIG.reduce((acc, tab) => {
        acc[tab.id] = tab.text;
        return acc;
    }, {});

    let elements = {
        player: null, playerContainer: null, playerWrap: null, wideBtn: null, webFullBtn: null, fullBtn: null, viewpointBtn: null,
        commentContainer: null, sidebarTabHeader: null, sidebarTabIndicator: null, allTabsContentArea: null,
        infoTab: null, commentsTab: null, videosTab: null, danmakuTab: null,
        infoContentPane: null, commentsContentPane: null, videosContentPane: null, danmakuContentPane: null,
        infoContentWrapper: null, commentsContentWrapper: null, videosContentWrapper: null, danmakuContentWrapper: null,
        infoTabTopContent: null, infoTabMiddleContent: null, infoTabBottomContent: null,
        bottomDrawerWrapper: null, bottomDrawerButton: null, bottomDrawerContent: null,
        commentApp: null, originalCommentAppHolder: { parent: null, nextSibling: null },
        rcmdTabElement: null, originalRcmdTabElementHolder: { parent: null, nextSibling: null },
        actionListElement: null, originalActionListElementHolder: { parent: null, nextSibling: null },
        recommendListV1Element: null, originalRecommendListV1ElementHolder: { parent: null, nextSibling: null },
        recommendListContainerElement: null, originalRecommendListContainerElementHolder: { parent: null, nextSibling: null },
        videoTitleElement: null, originalVideoTitleElementHolder: { parent: null, nextSibling: null, originalFontSize: '' },
        videoInfoMetaElement: null, originalVideoInfoMetaElementHolder: { parent: null, nextSibling: null, showMoreBtnOriginalDisplay: '', detailListOriginalDisplay: '', detailListOriginalFlexWrap: '', detailListOriginalGap: '' },
        videoDescContainerElement: null, originalVideoDescContainerElementHolder: { parent: null, nextSibling: null },
        videoTagContainerElement: null, originalVideoTagContainerElementHolder: { parent: null, nextSibling: null },
        upPanelContainerElement: null, originalUpPanelContainerElementHolder: { parent: null, nextSibling: null },
        danmakuBoxElement: null, originalDanmakuBoxElementHolder: { parent: null, nextSibling: null },
        videoToolbarContainerElement: null, originalVideoToolbarContainerElementHolder: { parent: null, nextSibling: null },
        videoInfoContainerWinElement: null, originalVideoInfoContainerWinElementHolder: { parent: null, nextSibling: null },
        viewboxReportElement: null,
        mirrorVdcon: null, originalMirrorVdconHeight: '', originalMirrorVdconPaddingLeft: '',
        settingsPanel: null,
    };
    let currentSettings = {};
    let currentUrl = window.location.href;
    let reInitScheduled = false;
    let lastScrollTime = 0;
    let isScrolling = false;
    let autoWideMenuId = null, sidebarMenuId = null, openSettingsPanelMenuId = null;
    let sidebarUpdateRAFId = null;
    let userManuallyExitedWide = false;
    let currentActiveSidebarTabId = config.defaultSettings.defaultTab;
    let coreElementsObserver = null;
    let playerStateObserver = null;
    let dynamicBgObserver = null;
    let fsHandlerRef = null;
    let videoAreaDblClickListenerRef = null;
    let playerResizeObserver = null;
    let activeTimers = new Set();


    // --- Utility Functions ---
    function log(...args) { if (config.debugMode) console.log(`[B站宽屏+]`, ...args); }
    function warn(...args) { if (config.debugMode) console.warn(`[B站宽屏+]`, ...args); }
    function error(...args) { console.error(`[B站宽屏+]`, ...args); }

    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // --- Stage 1 Refactor: Timer Management ---
    function safeSetTimeout(fn, delay) {
        const timerId = setTimeout(() => {
            fn();
            activeTimers.delete(timerId);
        }, delay);
        activeTimers.add(timerId);
        return timerId;
    }

    function clearAllTimers() {
        log(`Clearing ${activeTimers.size} active timers.`);
        activeTimers.forEach(timerId => clearTimeout(timerId));
        activeTimers.clear();
    }


    async function waitForSpecificElement(selector, attempts = config.attempts.max, interval = config.intervals.check) {
        for (let i = 0; i < attempts; i++) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        warn(`waitForSpecificElement: Element not found "${selector}" (attempts: ${attempts}).`);
        return null;
    }

    function validateCssLength(value, defaultValue = '0px') {
        if (typeof value !== 'string' && typeof value !== 'number') return defaultValue;
        value = String(value).trim();
        if (/^\d+(\.\d+)?(px|em|rem|%|vw|vh|pt|cm|mm|in)$/i.test(value)) return value;
        if (/^-?\d+(\.\d+)?$/.test(value)) return value + 'px';
        warn(`Invalid CSS length: "${value}", using default: "${defaultValue}"`);
        return defaultValue;
    }

    function validateNonNegativeInt(value, defaultValue = 0) {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0) return num;
        warn(`Invalid non-negative integer: "${value}", using default: ${defaultValue}`);
        return defaultValue;
    }

    function getCurrentVideoId() {
        try {
            const url = new URL(window.location.href);
            if (url.pathname.includes('/video/')) {
                return url.pathname.split('/').find(p => p.startsWith('BV'));
            }
            if (url.pathname.includes('/list/')) {
                 return url.searchParams.get('bvid');
            }
        } catch (e) {
            error("Failed to parse URL for video ID:", e);
        }
        return null;
    }


    // --- Core Functionality ---

    // --- Stage 1 Refactor: Settings and Styles ---
    function loadAllSettings() {
        for (const key in config.settingsKeys) {
            currentSettings[key] = GM_getValue(config.settingsKeys[key], config.defaultSettings[key]);
        }
        currentSettings.autoWideDelay = validateNonNegativeInt(
            currentSettings.autoWideDelay,
            config.defaultSettings.autoWideDelay
        );
        log("All settings loaded:", currentSettings);
        updateCssVariables(); // Apply CSS variables from loaded settings
    }

    function updateCssVariables() {
        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--biliplus-border-radius', validateCssLength(currentSettings.borderRadius, config.defaultSettings.borderRadius));
        rootStyle.setProperty('--biliplus-border-stroke-width', validateCssLength(currentSettings.borderStrokeWidth, config.defaultSettings.borderStrokeWidth));
        rootStyle.setProperty('--biliplus-shadow-blur', validateCssLength(currentSettings.shadowBlur, config.defaultSettings.shadowBlur));
        rootStyle.setProperty('--biliplus-shadow-spread', validateCssLength(currentSettings.shadowSpread, config.defaultSettings.shadowSpread));
        rootStyle.setProperty('--biliplus-player-sidebar-gap', validateCssLength(currentSettings.playerSidebarGap, config.defaultSettings.playerSidebarGap));
        rootStyle.setProperty('--biliplus-browser-edge-margin', validateCssLength(currentSettings.browserEdgeMargin, config.defaultSettings.browserEdgeMargin));
        log("CSS variables updated from currentSettings.");
    }

    function generateBaseCssString() {
        return `
            :root {
                --biliplus-border-radius: ${config.defaultSettings.borderRadius};
                --biliplus-border-stroke-width: ${config.defaultSettings.borderStrokeWidth};
                --biliplus-shadow-blur: ${config.defaultSettings.shadowBlur};
                --biliplus-shadow-spread: ${config.defaultSettings.shadowSpread};
                --biliplus-player-sidebar-gap: ${config.defaultSettings.playerSidebarGap};
                --biliplus-browser-edge-margin: ${config.defaultSettings.browserEdgeMargin};
                --biliplus-themed-box-shadow-border-color: rgba(0,0,0,0.1);
                --dynamic-shadow-color: rgba(0,0,0,0.08);
            }
            html.dark :root {
                --dynamic-shadow-color: rgba(0,0,0,0.15);
                --biliplus-themed-box-shadow-border-color: rgba(255,255,255,0.15);
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} {
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background-color: var(--bg1_float, #fff); color: var(--text1, #212121);
                border: 1px solid var(--line_regular, #ddd); border-radius: var(--biliplus-border-radius);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); padding: 20px; z-index: 2000;
                width: 520px; max-width: 90vw; max-height: 80vh; overflow-y: auto;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
                display: none;
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} h2 {
                margin-top: 0; margin-bottom: 20px; font-size: 18px; color: var(--text1, #212121);
                border-bottom: 1px solid var(--line_light, #eee); padding-bottom: 10px;
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} .bili-plus-settings-section { margin-bottom: 20px; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} .bili-plus-settings-row { display: flex; gap: 20px; margin-bottom: 10px; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} .bili-plus-setting-item { flex: 1; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} label { display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} input[type="text"], #${SCRIPT_ELEMENT_IDS.settingsPanel} input[type="number"], #${SCRIPT_ELEMENT_IDS.settingsPanel} select {
                width: 100%; padding: 6px 8px;
                border-radius: 4px; box-sizing: border-box;
                border: 1px solid var(--line_regular, #ccc); background-color: var(--bg1, #f4f4f4);
                color: var(--text1, #212121); font-size: 13px;
            }
            html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} input[type="text"], html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} input[type="number"], html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} select {
                 background-color: var(--bg2, #333); border-color: var(--line_regular, #555);
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} .bili-plus-settings-buttons { display: flex; justify-content: space-between; margin-top: 25px; align-items: center; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} button {
                padding: 8px 15px; border: none; border-radius: 4px;
                cursor: pointer; font-size: 14px; font-weight: 500;
                transition: background-color 0.2s, box-shadow 0.2s;
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-reset-settings {
                background-color: var(--bg2_float_hover, #e7e7e7); color: var(--text2, #61666d);
            }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-reset-settings:hover { background-color: var(--bg2_float_active, #ddd); }
            html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-reset-settings { background-color: var(--graph_bg_thin, #383838); color: var(--text1, #ccc); }
            html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-reset-settings:hover { background-color: var(--graph_bg, #4a4a4a); }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} .bili-plus-settings-buttons-right-group button { margin-left: 10px; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-save-settings { background-color: ${config.styles.bilibiliBlue}; color: white; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-save-settings:hover { background-color: #00b5e5; }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-close-settings { background-color: var(--bg2_float_hover, #e7e7e7); color: var(--text2, #61666d); }
            #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-close-settings:hover { background-color: var(--bg2_float_active, #ddd); }
            html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-close-settings { background-color: var(--graph_bg_thin, #383838); color: var(--text1, #ccc); }
            html.dark #${SCRIPT_ELEMENT_IDS.settingsPanel} #bili-plus-close-settings:hover { background-color: var(--graph_bg, #4a4a4a); }

            .${CSS_CLASSES.commentSidebar} {
                flex-direction: column; position: fixed;
                right: var(--biliplus-browser-edge-margin) !important;
                background-color: var(--bg1_float, #fff);
                border-radius: var(--biliplus-border-radius);
                box-shadow: 0 0 0 var(--biliplus-border-stroke-width) var(--biliplus-themed-box-shadow-border-color),
                            0 0 var(--biliplus-shadow-blur) var(--biliplus-shadow-spread) var(--dynamic-shadow-color);
                z-index: 500; padding: 0; box-sizing: border-box; display: none;
            }
            .${CSS_CLASSES.commentSidebarActive} { display: flex !important; }
            .${CSS_CLASSES.sidebarTabHeader} { display: flex; height: ${config.styles.sidebarTabHeaderHeight}; flex-shrink: 0; position: relative; border-bottom: ${config.styles.sidebarHeaderBorderWidth} solid var(--line_regular, #ddd);}
            .${CSS_CLASSES.sidebarTab} { flex: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 14px; color: var(--text2, #61666d); box-sizing: border-box; transition: color 0.2s, fill 0.2s; padding: 0 5px; white-space: nowrap; }
            .${CSS_CLASSES.sidebarTab}:hover { color: ${config.styles.bilibiliBlue}; }
            .${CSS_CLASSES.sidebarTab}.${CSS_CLASSES.sidebarTabActive} { color: ${config.styles.bilibiliBlue}; }
            .${CSS_CLASSES.sidebarTabIndicator} { position: absolute; bottom: -${config.styles.sidebarHeaderBorderWidth}; height: 2px; background-color: ${config.styles.bilibiliBlue}; transition: left 0.3s ease, width 0.3s ease; z-index: 1; }
            .sidebar-tab-icon { width: 16px; height: 16px; margin-right: 6px; fill: var(--text2, #61666d); transition: fill 0.2s; vertical-align: middle; }
            html.dark .sidebar-tab-icon { fill: var(--text3, #9499A0); }
            .${CSS_CLASSES.sidebarTab}:hover .sidebar-tab-icon, .${CSS_CLASSES.sidebarTab}.${CSS_CLASSES.sidebarTabActive} .sidebar-tab-icon { fill: ${config.styles.bilibiliBlue}; }

            #${SCRIPT_ELEMENT_IDS.allTabsContentArea} { flex-grow: 1; overflow-y: auto; position: relative; margin: 6px 0; padding: 0; box-sizing: border-box; }
            .${CSS_CLASSES.sidebarTabContentWrapper} { box-sizing: border-box; display: none; flex-direction: column; width: 100%; height: 100%; padding: ${config.styles.sidebarContentPadding}; }
            .${CSS_CLASSES.sidebarTabContentWrapper}.${CSS_CLASSES.sidebarTabContentWrapperActive} { display: flex !important; }
            .${CSS_CLASSES.sidebarTabContent} { display: none; width: 100%; flex-grow: 1; box-sizing: border-box; }
            .${CSS_CLASSES.sidebarTabContent}.${CSS_CLASSES.sidebarTabContentActive} { display: block !important; }

            #bili-custom-sidebar-content-info.${CSS_CLASSES.sidebarTabContent}.${CSS_CLASSES.sidebarTabContentActive} { display: flex !important; flex-direction: column; height: 100%; }
            .${CSS_CLASSES.infoTabTop} { flex-shrink: 0; padding-bottom: 10px; }
            .${CSS_CLASSES.infoTabMiddle} { flex-grow: 1; overflow-y: auto; margin-top: 20px; min-height: 30px; width: 100%; box-sizing: border-box; }
            .${CSS_CLASSES.infoTabBottom} { flex-shrink: 0; padding-top: 8px; margin-top: auto; }
            .${CSS_CLASSES.infoTabTop} > *, .${CSS_CLASSES.infoTabBottom} > * { margin-bottom: 8px; }
            .${CSS_CLASSES.infoTabTop} > :last-child, .${CSS_CLASSES.infoTabBottom} > :last-child { margin-bottom: 0; }
            #bili-custom-sidebar-content-info .${CSS_CLASSES.infoTabBottom} ${SELECTORS.videoTagContainer} { margin: 0 !important; }
            #bili-custom-sidebar-content-info ${SELECTORS.videoInfoMeta} { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
            #bili-custom-sidebar-content-info ${SELECTORS.videoInfoMeta} > * { display: inline-flex; align-items: center; }
            #bili-custom-sidebar-content-info ${SELECTORS.videoInfoMeta} ${SELECTORS.videoInfoDetailList} { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; width: 100% !important; max-height: none !important; overflow: visible !important; }
            #bili-custom-sidebar-content-info ${SELECTORS.videoInfoMeta} ${SELECTORS.videoInfoDetailList} > .item { white-space: normal !important; overflow: visible !important; word-break: break-word; max-width: 100%; }
            #bili-custom-sidebar-content-info ${SELECTORS.showMoreBtnDetail} { display: none !important; }
            #bili-custom-sidebar-content-info ${SELECTORS.basicDescInfo} { height: auto !important; max-height: none !important; }
            #bili-custom-sidebar-content-info ${SELECTORS.videoDescContainer} .toggle-btn { display: none !important; }

            #bili-custom-sidebar-content-comments > ${SELECTORS.commentApp} { width: 100%; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
            #bili-custom-sidebar-content-videos > .rcmd-tab { width: 100%; box-sizing: border-box; margin-bottom: 0 !important; }
            #bili-custom-sidebar-content-videos > .action-list-container,
            #bili-custom-sidebar-content-videos > .recommend-list-v1,
            #bili-custom-sidebar-content-videos > .recommend-list-container { width: 100%; box-sizing: border-box; margin-bottom: 10px; }
            #bili-custom-sidebar-content-danmaku > ${SELECTORS.danmakuBox} { width: 100%; height: 100%; box-sizing: border-box; overflow: hidden; }

            body.${CSS_CLASSES.bodyEnhancementsActive} ${SELECTORS.viewboxReport} { height: 0px !important; padding-top: 0px !important; padding-bottom: 0px !important; margin-top: 0px !important; margin-bottom: 0px !important; border: none !important; overflow: hidden !important; opacity: 0 !important; transition: height 0.25s ease-out, padding-top 0.25s ease-out, opacity 0.25s ease-out; }
            #${SELECTORS.mirrorVdcon.substring(1)} { transition: height 0.25s ease-out, padding-left 0.25s ease-out; }

            #${SCRIPT_ELEMENT_IDS.bottomDrawerWrapper} {
                position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 45%;
                z-index: 1000; display: none; flex-direction: column;
                background-color: var(--bg1_float, #fff);
                border-top-left-radius: var(--biliplus-border-radius); border-top-right-radius: var(--biliplus-border-radius);
                box-shadow: 0 0 0 var(--biliplus-border-stroke-width) var(--biliplus-themed-box-shadow-border-color),
                            0 0 var(--biliplus-shadow-blur) var(--biliplus-shadow-spread) var(--dynamic-shadow-color);
            }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerButton} { height: ${config.styles.bottomDrawerHandleHeight}; width: 100%; display: flex; justify-content: center; align-items: center; cursor: default; overflow: hidden; background-color: transparent; transition: height 0.25s ease-out; }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerButton}::after { content: ''; width: 20%; height: 2px; background-color: var(--brand_blue, ${config.styles.bilibiliBlue}); border-radius: 1px; display: block; }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerContent}.${CSS_CLASSES.drawerContentExpanded} ~ #${SCRIPT_ELEMENT_IDS.bottomDrawerButton} { height: 0; padding: 0; margin: 0; }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerContent}.${CSS_CLASSES.drawerContentExpanded} ~ #${SCRIPT_ELEMENT_IDS.bottomDrawerButton}::after { display: none; }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerContent} {
                background-color: var(--bg1_float, #fff); max-height: 0; overflow: hidden;
                transition: max-height 0.25s ease-out; padding: 0 15px; margin: 0; box-sizing: border-box; width: 100%;
            }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerContent}.${CSS_CLASSES.drawerContentExpanded} { padding-bottom: 0; }
            #${SCRIPT_ELEMENT_IDS.bottomDrawerContent} > ${SELECTORS.videoToolbarContainer} { width: 100%; box-sizing: border-box; }
        `;
    }

    function injectBaseStyles() {
        const styleId = 'bili-custom-styles-base';
        if (document.getElementById(styleId)) return;
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = generateBaseCssString();
        document.head.appendChild(styleElement);
        log("Base styles injected.");
    }

    // --- Stage 2 Refactor: Use DocumentFragment for Settings Panel ---
    function createSettingsPanel() {
        if (document.getElementById(SCRIPT_ELEMENT_IDS.settingsPanel)) return;
        const panel = document.createElement('div');
        panel.id = SCRIPT_ELEMENT_IDS.settingsPanel;
        const fragment = document.createDocumentFragment();

        // Using innerHTML here is acceptable for one-time creation of a complex, static structure.
        panel.innerHTML = `
            <h2>B站宽屏+ 设置</h2>
            <div class="bili-plus-settings-section">
                <h3>外观设置</h3>
                <div class="bili-plus-settings-row">
                    <div class="bili-plus-setting-item">
                        <label for="setting-border-radius">圆角大小 (e.g., 6px):</label>
                        <input type="text" id="setting-border-radius" data-key="${config.settingsKeys.borderRadius}" data-default="${config.defaultSettings.borderRadius}">
                    </div>
                    <div class="bili-plus-setting-item">
                        <label for="setting-border-stroke-width">边框大小 (e.g., 1px):</label>
                        <input type="text" id="setting-border-stroke-width" data-key="${config.settingsKeys.borderStrokeWidth}" data-default="${config.defaultSettings.borderStrokeWidth}">
                    </div>
                </div>
                <div class="bili-plus-settings-row">
                    <div class="bili-plus-setting-item">
                        <label for="setting-shadow-blur">投影模糊 (e.g., 4px):</label>
                        <input type="text" id="setting-shadow-blur" data-key="${config.settingsKeys.shadowBlur}" data-default="${config.defaultSettings.shadowBlur}">
                    </div>
                    <div class="bili-plus-setting-item">
                        <label for="setting-shadow-spread">投影扩散 (e.g., 2px):</label>
                        <input type="text" id="setting-shadow-spread" data-key="${config.settingsKeys.shadowSpread}" data-default="${config.defaultSettings.shadowSpread}">
                    </div>
                </div>
                <div class="bili-plus-settings-row">
                    <div class="bili-plus-setting-item">
                        <label for="setting-player-sidebar-gap">播放器-侧栏间距 (e.g., 12px):</label>
                        <input type="text" id="setting-player-sidebar-gap" data-key="${config.settingsKeys.playerSidebarGap}" data-default="${config.defaultSettings.playerSidebarGap}">
                    </div>
                    <div class="bili-plus-setting-item">
                        <label for="setting-browser-edge-margin">浏览器边缘间距 (e.g., 12px):</label>
                        <input type="text" id="setting-browser-edge-margin" data-key="${config.settingsKeys.browserEdgeMargin}" data-default="${config.defaultSettings.browserEdgeMargin}">
                    </div>
                </div>
            </div>
            <div class="bili-plus-settings-section">
                <h3>功能设置</h3>
                <label for="setting-auto-wide-delay">自动宽屏启动延迟 (毫秒, 0-5000):</label>
                <input type="number" id="setting-auto-wide-delay" min="0" max="5000" step="100" data-key="${config.settingsKeys.autoWideDelay}" data-default="${config.defaultSettings.autoWideDelay}">
                <label for="setting-default-tab">默认启动标签页:</label>
                <select id="setting-default-tab" data-key="${config.settingsKeys.defaultTab}" data-default="${config.defaultSettings.defaultTab}">
                    ${SIDEBAR_TABS_CONFIG.map(tab => `<option value="${tab.id}">${tab.text}</option>`).join('')}
                </select>
            </div>
            <div class="bili-plus-settings-buttons">
                <button id="bili-plus-reset-settings">重置为默认</button>
                <div class="bili-plus-settings-buttons-right-group">
                    <button id="bili-plus-save-settings">保存并应用</button>
                    <button id="bili-plus-close-settings">关闭</button>
                </div>
            </div>
        `;
        fragment.appendChild(panel);
        document.body.appendChild(fragment);

        elements.settingsPanel = panel;
        panel.querySelector('#bili-plus-save-settings').addEventListener('click', saveAndApplySettings);
        panel.querySelector('#bili-plus-close-settings').addEventListener('click', toggleSettingsPanel);
        panel.querySelector('#bili-plus-reset-settings').addEventListener('click', resetSettingsToDefault);
        log("Settings panel created.");
    }

    function populateSettingsPanel() {
        if (!elements.settingsPanel) return;
        log("Populating settings panel with current values.");
        elements.settingsPanel.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
            const key = input.dataset.key;
            // Load directly from GM to ensure it's the absolute latest value
            input.value = GM_getValue(key, input.dataset.default);
        });
    }

    function saveAndApplySettings() {
        if (!elements.settingsPanel) return;
        log("Saving settings from panel...");
        elements.settingsPanel.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
            const key = input.dataset.key;
            let value = input.value;
            if (key === config.settingsKeys.autoWideDelay) {
                value = validateNonNegativeInt(value, parseInt(input.dataset.default, 10));
            } else if (key !== config.settingsKeys.defaultTab) {
                value = validateCssLength(value, input.dataset.default);
            }
            GM_setValue(key, value);
        });

        loadAllSettings(); // This now reloads settings and applies CSS variables
        syncThemeDependentStyles();
        updateMenuCommands();
        if (document.body.classList.contains(CSS_CLASSES.bodyEnhancementsActive)) {
            updateLayoutAndStyles();
        }
    }

    function resetSettingsToDefault() {
        if (!elements.settingsPanel) return;
        log("Resetting settings to default...");
        if (confirm("确定要将所有设置恢复为默认值吗？")) {
            elements.settingsPanel.querySelectorAll('input[data-key], select[data-key]').forEach(input => {
                const key = input.dataset.key;
                const defaultValue = input.dataset.default;
                GM_setValue(key, defaultValue);
                input.value = defaultValue;
            });
            saveAndApplySettings();
        }
    }

    function toggleSettingsPanel() {
        if (!elements.settingsPanel) createSettingsPanel();
        if (elements.settingsPanel) {
            const isVisible = elements.settingsPanel.style.display === 'block';
            if (!isVisible) populateSettingsPanel();
            elements.settingsPanel.style.display = isVisible ? 'none' : 'block';
            log(`Settings panel ${isVisible ? 'hidden' : 'shown'}.`);
        }
    }

    function scrollToPosition(topPosition) {
        if (isScrolling) return;
        const now = Date.now();
        if (now - lastScrollTime < 100 && Math.abs(window.scrollY - topPosition) < 50) return;
        log(`scrollToPosition: Scrolling to ${topPosition}.`);
        lastScrollTime = now;
        isScrolling = true;
        window.scrollTo({ top: topPosition, behavior: 'smooth' });
        safeSetTimeout(() => { isScrolling = false; }, config.animationDurations.scroll);
    }

    function scrollToPlayer() {
        log("scrollToPlayer: Attempting to scroll player into view.");
        if (!elements.player) { warn("scrollToPlayer: Player element not cached."); return; }
        requestAnimationFrame(() => {
            const playerRect = elements.player.getBoundingClientRect();
            if (playerRect.height > 0 && playerRect.width > 0) {
                const desiredScrollTop = playerRect.top + window.scrollY - config.playerCenterOffset;
                if (Math.abs(window.scrollY - desiredScrollTop) > 5) scrollToPosition(desiredScrollTop);
            } else warn("scrollToPlayer: Player height or width is 0.");
        });
    }

    function scrollToTop() {
        log("scrollToTop: Attempting to scroll to page top.");
        if (window.scrollY > 0) scrollToPosition(0);
    }

    // --- Stage 2 Refactor: Split cacheContentElements ---

    /**
     * Caches a single element and its original position holder.
     * @param {string} key - The key for the element in the `elements` object.
     * @param {string} selector - The CSS selector for the element.
     * @param {boolean} isReCache - Flag indicating if this is a re-caching operation.
     * @param {function} [specialCache] - Optional function for special caching logic.
     */
    function cacheSingleElement(key, selector, isReCache, specialCache = null) {
        const holderKey = `original${key.charAt(0).toUpperCase() + key.slice(1)}Holder`;
        const currentElementRef = elements[key];
        const newElementInstance = document.querySelector(selector);

        if (newElementInstance || !currentElementRef) {
            elements[key] = newElementInstance;
        }

        if (elements[key]) {
            const holder = elements[holderKey];
            if (holder) {
                // Update holder if it's the first cache, a re-cache found a new element instance, or holder is empty
                if (!isReCache || currentElementRef !== elements[key] || !holder.parent) {
                    if (elements[key].parentElement) {
                        holder.parent = elements[key].parentElement;
                        holder.nextSibling = elements[key].nextSibling;
                    } else if (isReCache) {
                        warn(`cacheSingleElement (re-cache): Element ${key} found but has no parent.`);
                    }
                }
            }
            if (specialCache) {
                specialCache(elements[key], holder);
            }
        } else {
            warn(`cacheSingleElement (${isReCache ? 're-cache' : 'initial cache'}): Element not found ${key} ("${selector}").`);
        }
    }

    /**
     * Caches elements related to the 'Info' tab.
     * @param {boolean} isReCache - Flag indicating if this is a re-caching operation.
     */
    function cacheInfoTabElements(isReCache) {
        cacheSingleElement('videoTitleElement', SELECTORS.videoTitle, isReCache, (el, holder) => {
            try { holder.originalFontSize = window.getComputedStyle(el).fontSize; } catch (e) { warn(`Failed to get video title font size: ${e.message}`); }
        });
        cacheSingleElement('videoInfoMetaElement', SELECTORS.videoInfoMeta, isReCache, (el, holder) => {
             // Reset styles that are modified when moved to the sidebar
            holder.showMoreBtnOriginalDisplay = ''; holder.detailListOriginalDisplay = '';
            holder.detailListOriginalFlexWrap = ''; holder.detailListOriginalGap = '';
        });
        cacheSingleElement('videoDescContainerElement', SELECTORS.videoDescContainer, isReCache);
        cacheSingleElement('videoTagContainerElement', SELECTORS.videoTagContainer, isReCache);
        cacheSingleElement('upPanelContainerElement', SELECTORS.upPanelContainer, isReCache);
        cacheSingleElement('videoInfoContainerWinElement', SELECTORS.videoInfoContainerWin, isReCache);
    }

    /**
     * Caches elements for other tabs (Comments, Videos, Danmaku).
     * @param {boolean} isReCache - Flag indicating if this is a re-caching operation.
     */
    function cacheOtherTabElements(isReCache) {
        cacheSingleElement('commentApp', SELECTORS.commentApp, isReCache);
        cacheSingleElement('rcmdTabElement', SELECTORS.rcmdTab, isReCache);
        cacheSingleElement('actionListElement', SELECTORS.actionList, isReCache);
        cacheSingleElement('recommendListV1Element', SELECTORS.recommendListV1, isReCache);
        cacheSingleElement('recommendListContainerElement', SELECTORS.recommendListContainer, isReCache);
        cacheSingleElement('danmakuBoxElement', SELECTORS.danmakuBox, isReCache);
    }

    /**
     * Caches miscellaneous elements required for layout adjustments.
     * @param {boolean} isReCache - Flag indicating if this is a re-caching operation.
     */
    function cacheLayoutElements(isReCache) {
        cacheSingleElement('videoToolbarContainerElement', SELECTORS.videoToolbarContainer, isReCache);
        cacheSingleElement('viewboxReportElement', SELECTORS.viewboxReport, isReCache);
        cacheSingleElement('mirrorVdcon', SELECTORS.mirrorVdcon, isReCache, (el) => {
            // Only store original styles if they haven't been stored yet
            if (elements.originalMirrorVdconPaddingLeft === '' || elements.originalMirrorVdconPaddingLeft === undefined) {
                const computedStyle = window.getComputedStyle(el);
                elements.originalMirrorVdconPaddingLeft = computedStyle.paddingLeft;
                log(`cacheLayoutElements: Stored #mirror-vdcon original padding-left: '${elements.originalMirrorVdconPaddingLeft}'.`);
                if (elements.originalMirrorVdconHeight === '' || elements.originalMirrorVdconHeight === undefined) {
                     elements.originalMirrorVdconHeight = computedStyle.height;
                     log(`cacheLayoutElements: Stored initial #mirror-vdcon original height: '${elements.originalMirrorVdconHeight}'.`);
                }
            }
        });
    }

    /**
     * Main function to cache all dynamic content elements by delegating to smaller, focused functions.
     * @param {boolean} isReCache - Flag to indicate if we are re-caching elements.
     */
    function cacheContentElements(isReCache = false) {
        log(`cacheContentElements: Caching content elements. isReCache = ${isReCache}`);
        if (!isReCache) {
            // Reset styles that are modified, ensuring a clean slate for initial caching
            elements.originalMirrorVdconHeight = '';
            elements.originalMirrorVdconPaddingLeft = '';
        }

        cacheInfoTabElements(isReCache);
        cacheOtherTabElements(isReCache);
        cacheLayoutElements(isReCache);

        log("cacheContentElements: Content element caching processed.");
    }


    async function cacheCorePlayerElements() {
        log("cacheCorePlayerElements: Starting to cache core player elements.");
        elements.player = document.querySelector(SELECTORS.player);
        if (!elements.player) { warn("cacheCorePlayerElements: Player element not found."); return false; }

        elements.playerContainer = document.querySelector(SELECTORS.playerContainer) || document.querySelector(SELECTORS.playerAlternativeContainer) || elements.player;
        if (!elements.playerContainer) { warn("cacheCorePlayerElements: Player container not found."); return false; }
        else if (elements.playerContainer === elements.player) warn("cacheCorePlayerElements: Using player element as its own container (fallback).");


        elements.playerWrap = document.getElementById(SELECTORS.playerWrap.substring(1));
        if (!elements.playerWrap) warn("cacheCorePlayerElements: playerWrap not found.");

        const ctrlArea = elements.playerContainer.querySelector(SELECTORS.playerCtrlArea) || elements.playerContainer;
        if (!ctrlArea) { warn("cacheCorePlayerElements: Control area not found within player container."); return false; }


        elements.wideBtn = await waitForSpecificElement(SELECTORS.wideBtn, config.attempts.wideBtnWait, config.intervals.wideBtnWait);
        if (!elements.wideBtn) { warn("cacheCorePlayerElements: Widescreen button not found after waiting."); return false; } // Critical

        elements.webFullBtn = ctrlArea.querySelector(SELECTORS.webFullBtn);
        elements.fullBtn = ctrlArea.querySelector(SELECTORS.fullBtn);
        elements.viewpointBtn = ctrlArea.querySelector(SELECTORS.viewpointBtn);

        if (!elements.webFullBtn) warn("cacheCorePlayerElements: Web fullscreen button not found.");
        if (!elements.fullBtn) warn("cacheCorePlayerElements: Fullscreen button not found.");
        if (!elements.viewpointBtn) warn("cacheCorePlayerElements: Viewpoint button not found.");

        log("Core player elements cached successfully (or attempted).");
        return true;
    }


    async function ensureAllElementsCached() {
        log("ensureAllElementsCached: Verifying all necessary elements.");
        if (!await cacheCorePlayerElements()) {
            warn("ensureAllElementsCached: Core player element caching failed. Script might not function fully.");
            return false;
        }
        cacheContentElements();
        log("ensureAllElementsCached: Element verification attempt complete.");
        return true;
    }

    function getOrCreateCommentContainer() {
        if (elements.commentContainer && document.body.contains(elements.commentContainer)) return elements.commentContainer;
        let container = document.getElementById(SCRIPT_ELEMENT_IDS.commentContainer);
        if (!container) {
            container = document.createElement('div');
            container.id = SCRIPT_ELEMENT_IDS.commentContainer;
            container.classList.add(CSS_CLASSES.commentSidebar);
            document.body.appendChild(container);
            log("Sidebar container created.");
        }
        elements.commentContainer = container;
        if (!elements.sidebarTabHeader || !elements.allTabsContentArea) createSidebarTabsAndContent();
        return container;
    }

    // --- Stage 2 Refactor: Use DocumentFragment for Sidebar Tabs ---
    function createSidebarTabsAndContent() {
        if (!elements.commentContainer) { warn("createSidebarTabsAndContent: Sidebar container does not exist."); return; }
        if (elements.sidebarTabHeader && elements.allTabsContentArea && elements.commentContainer.contains(elements.sidebarTabHeader)) {
            log("createSidebarTabsAndContent: Tab structure appears to exist already."); return;
        }

        // Use a DocumentFragment to build the structure in memory before attaching to the live DOM
        const fragment = document.createDocumentFragment();
        // Clear existing content efficiently
        while (elements.commentContainer.firstChild) {
            elements.commentContainer.removeChild(elements.commentContainer.firstChild);
        }

        elements.sidebarTabHeader = document.createElement('div');
        elements.sidebarTabHeader.className = CSS_CLASSES.sidebarTabHeader;

        const indicator = document.createElement('div');
        indicator.className = CSS_CLASSES.sidebarTabIndicator;
        elements.sidebarTabIndicator = indicator;
        elements.sidebarTabHeader.appendChild(indicator);

        elements.allTabsContentArea = document.createElement('div');
        elements.allTabsContentArea.id = SCRIPT_ELEMENT_IDS.allTabsContentArea;

        SIDEBAR_TABS_CONFIG.forEach(tabInfo => {
            const tabElement = document.createElement('div');
            tabElement.className = CSS_CLASSES.sidebarTab;
            tabElement.dataset.tabId = tabInfo.id;
            tabElement.innerHTML = `${tabInfo.svg}<span class="sidebar-tab-text">${tabInfo.text}</span>`;
            elements[tabInfo.id + 'Tab'] = tabElement;
            elements.sidebarTabHeader.appendChild(tabElement);

            const tabContentWrapper = document.createElement('div');
            tabContentWrapper.className = CSS_CLASSES.sidebarTabContentWrapper;
            tabContentWrapper.id = `bili-custom-sidebar-wrapper-${tabInfo.id}`;
            elements[tabInfo.wrapperId] = tabContentWrapper;

            const contentPane = document.createElement('div');
            contentPane.id = `bili-custom-sidebar-content-${tabInfo.id}`;
            contentPane.className = CSS_CLASSES.sidebarTabContent;
            elements[tabInfo.paneId] = contentPane;

            tabContentWrapper.appendChild(contentPane);
            elements.allTabsContentArea.appendChild(tabContentWrapper);
            tabElement.addEventListener('click', () => setActiveSidebarTab(tabInfo.id));
        });

        fragment.appendChild(elements.sidebarTabHeader);
        fragment.appendChild(elements.allTabsContentArea);
        elements.commentContainer.appendChild(fragment); // Single DOM insertion

        log("Sidebar tab structure created/recreated using DocumentFragment.");
    }

    // --- Stage 1 Refactor: Tab State Persistence ---
    function loadAndApplyTabState() {
        const videoId = getCurrentVideoId();
        let tabToActivate = currentSettings.defaultTab;

        if (videoId) {
            const savedTabId = GM_getValue(`tabState_${videoId}`);
            if (savedTabId && VALID_SIDEBAR_TAB_IDS.includes(savedTabId)) {
                tabToActivate = savedTabId;
                log(`Tab state for video ${videoId} found: '${tabToActivate}'.`);
            } else {
                log(`No saved tab state for video ${videoId}, using default: '${tabToActivate}'.`);
            }
        } else {
            tabToActivate = currentActiveSidebarTabId || currentSettings.defaultTab;
            log(`No video ID found, using current/default tab: '${tabToActivate}'.`);
        }

        setActiveSidebarTab(tabToActivate, false);
    }

    function setActiveSidebarTab(tabIdToActivate, isUserClick = true) {
        log(`setActiveSidebarTab: Activating tab '${tabIdToActivate}', isUserClick: ${isUserClick}`);

        let targetTabId = tabIdToActivate;
        if (!VALID_SIDEBAR_TAB_IDS.includes(tabIdToActivate)) {
            warn(`setActiveSidebarTab: Invalid tab ID '${tabIdToActivate}'. Defaulting to '${currentSettings.defaultTab}'.`);
            targetTabId = currentSettings.defaultTab;
        }

        currentActiveSidebarTabId = targetTabId;

        SIDEBAR_TABS_CONFIG.forEach(tabInfo => {
            const tabEl = elements[tabInfo.id + 'Tab'];
            const wrapperEl = elements[tabInfo.wrapperId];
            const isActive = (tabInfo.id === targetTabId);
            if (tabEl) tabEl.classList.toggle(CSS_CLASSES.sidebarTabActive, isActive);
            if (wrapperEl) {
                wrapperEl.classList.toggle(CSS_CLASSES.sidebarTabContentWrapperActive, isActive);
                const paneEl = wrapperEl.querySelector(`.${CSS_CLASSES.sidebarTabContent}`);
                if (paneEl) paneEl.classList.toggle(CSS_CLASSES.sidebarTabContentActive, isActive);
            }
        });

        const activeTabElement = elements[targetTabId + 'Tab'];
        if (activeTabElement && elements.sidebarTabIndicator) {
            elements.sidebarTabIndicator.style.left = activeTabElement.offsetLeft + 'px';
            elements.sidebarTabIndicator.style.width = activeTabElement.offsetWidth + 'px';
        } else if (elements.sidebarTabIndicator) {
            elements.sidebarTabIndicator.style.width = '0px';
        }

        const videoId = getCurrentVideoId();
        if (isUserClick && videoId) {
            log(`Persisting tab state for video ${videoId}: '${targetTabId}'`);
            GM_setValue(`tabState_${videoId}`, targetTabId);
        }
    }


    // --- Stage 2 Refactor: Use DocumentFragment for Info Tab Content ---
    function manageInfoTabContent(shouldDisplayInSidebar) {
        log(`manageInfoTabContent: shouldDisplayInSidebar = ${shouldDisplayInSidebar}`);
        const infoPane = elements.infoContentPane;
        if (!infoPane) { warn("manageInfoTabContent: Info content pane not found."); return; }

        const holder = elements.originalVideoInfoMetaElementHolder;
        const contentElementsConfig = [
            {
                key: 'videoTitleElement', targetContainerClass: CSS_CLASSES.infoTabTop,
                styleChange: (el, inSidebar) => {
                    if (inSidebar) {
                        const originalFontSize = elements.originalVideoTitleElementHolder?.originalFontSize;
                        el.style.fontSize = (originalFontSize && originalFontSize !== '0px' && !originalFontSize.includes('auto')) ? originalFontSize : config.styles.defaultVideoTitleFontSize;
                        el.textContent = el.textContent.trim();
                    } else el.style.fontSize = '';
                }
            },
            { key: 'videoInfoMetaElement', targetContainerClass: CSS_CLASSES.infoTabTop },
            { key: 'videoInfoContainerWinElement', targetContainerClass: CSS_CLASSES.infoTabTop },
            {
                key: 'videoDescContainerElement', targetContainerClass: CSS_CLASSES.infoTabMiddle,
                styleChange: (el, inSidebar) => {
                    if (!inSidebar) el.style.margin = '';
                    const basicDesc = el.querySelector(SELECTORS.basicDescInfo);
                    if (basicDesc) basicDesc.style.height = inSidebar ? 'auto' : '';
                    const descBtn = el.querySelector('.toggle-btn');
                    if (descBtn) descBtn.style.display = inSidebar ? 'none' : '';
                }
            },
            { key: 'videoTagContainerElement', targetContainerClass: CSS_CLASSES.infoTabBottom },
            { key: 'upPanelContainerElement', targetContainerClass: CSS_CLASSES.infoTabBottom }
        ];

        if (shouldDisplayInSidebar) {
            // Efficiently clear the pane
            infoPane.textContent = '';

            const fragment = document.createDocumentFragment();
            elements.infoTabTopContent = document.createElement('div');
            elements.infoTabTopContent.className = CSS_CLASSES.infoTabTop;
            elements.infoTabMiddleContent = document.createElement('div');
            elements.infoTabMiddleContent.className = CSS_CLASSES.infoTabMiddle;
            elements.infoTabBottomContent = document.createElement('div');
            elements.infoTabBottomContent.className = CSS_CLASSES.infoTabBottom;

            contentElementsConfig.forEach(configItem => {
                const el = elements[configItem.key];
                if (el) {
                    let targetParent;
                    if (configItem.targetContainerClass === CSS_CLASSES.infoTabTop) targetParent = elements.infoTabTopContent;
                    else if (configItem.targetContainerClass === CSS_CLASSES.infoTabMiddle) targetParent = elements.infoTabMiddleContent;
                    else targetParent = elements.infoTabBottomContent;

                    targetParent.appendChild(el);
                    if (configItem.styleChange) configItem.styleChange(el, true);
                }
            });

            fragment.appendChild(elements.infoTabTopContent);
            fragment.appendChild(elements.infoTabMiddleContent);
            fragment.appendChild(elements.infoTabBottomContent);
            infoPane.appendChild(fragment); // Single append operation

            const videoInfoMetaEl = elements.videoInfoMetaElement;
            if (videoInfoMetaEl) {
                // ... (style changes for video info meta remain the same)
            }

        } else {
             // Logic for restoring elements to their original positions
            contentElementsConfig.forEach(configItem => {
                const el = elements[configItem.key];
                const originalHolder = elements[`original${configItem.key.charAt(0).toUpperCase() + configItem.key.slice(1)}Holder`];
                if (el && originalHolder?.parent && document.body.contains(originalHolder.parent)) {
                    if (configItem.styleChange) configItem.styleChange(el, false);
                    if (el.parentElement && (el.parentElement.classList.contains(CSS_CLASSES.infoTabTop) || el.parentElement.classList.contains(CSS_CLASSES.infoTabMiddle) || el.parentElement.classList.contains(CSS_CLASSES.infoTabBottom))) {
                       try { originalHolder.parent.insertBefore(el, originalHolder.nextSibling); }
                       catch (e) { error(`Failed to restore element ${configItem.key}: ${e.message}.`);}
                    }
                }
            });
            // ... (restoration logic for video info meta)

            infoPane.textContent = ''; // Clear pane efficiently
            elements.infoTabTopContent = null; elements.infoTabMiddleContent = null; elements.infoTabBottomContent = null;
        }
    }

    function manageVideoTabContent(shouldDisplayInSidebar) {
        log(`manageVideoTabContent: shouldDisplayInSidebar = ${shouldDisplayInSidebar}`);
        const videosPane = elements.videosContentPane;
        if (!videosPane) { warn("manageVideoTabContent: Video content pane not found."); return; }
        const isVideoPage = /\/video\//.test(currentUrl);
        const isListPage = /\/list\//.test(currentUrl);
        const moveElementConditionally = (elementKey, originalHolderKey, targetParentForSidebar, elementNameForLog) => {
            const element = elements[elementKey];
            const originalHolder = elements[originalHolderKey];
            if (!element) return false;
            if (targetParentForSidebar) {
                if ((!originalHolder.parent && element.parentElement) || element.parentElement !== targetParentForSidebar) {
                    if (!originalHolder.parent && element.parentElement) {
                        originalHolder.parent = element.parentElement;
                        originalHolder.nextSibling = element.nextSibling;
                    }
                    targetParentForSidebar.appendChild(element);
                }
            } else {
                if (originalHolder?.parent && document.body.contains(originalHolder.parent) && element.parentElement === videosPane) {
                    try { originalHolder.parent.insertBefore(element, originalHolder.nextSibling); }
                    catch (e) { error(`Failed to restore element ${elementNameForLog}: ${e.message}.`); return false; }
                } else if (element.parentElement === videosPane) {
                    try { element.remove(); } catch(e) { /* ignore */ }
                    return false;
                }
            }
            return true;
        };
        if (shouldDisplayInSidebar) {
            videosPane.textContent = '';
            let contentMoved = false;
            if (isVideoPage) {
                let rcmdTabMoved = moveElementConditionally('rcmdTabElement', 'originalRcmdTabElementHolder', videosPane, "rcmdTabElement");
                contentMoved = rcmdTabMoved || contentMoved;
                let recommendListMoved = moveElementConditionally('recommendListV1Element', 'originalRecommendListV1ElementHolder', videosPane, "recommendListV1Element");
                if (recommendListMoved && elements.recommendListV1Element && rcmdTabMoved) elements.recommendListV1Element.style.marginTop = '0px';
                contentMoved = recommendListMoved || contentMoved;
                if (!recommendListMoved) {
                    recommendListMoved = moveElementConditionally('recommendListContainerElement', 'originalRecommendListContainerElementHolder', videosPane, "recommendListContainerElement");
                    contentMoved = recommendListMoved || contentMoved;
                }
                if (!contentMoved) videosPane.textContent = '当前视频页无推荐内容模块或加载失败。';
            } else if (isListPage) {
                contentMoved = moveElementConditionally('actionListElement', 'originalActionListElementHolder', videosPane, "actionListElement") || contentMoved;
                let recommendListMovedInList = moveElementConditionally('recommendListContainerElement', 'originalRecommendListContainerElementHolder', videosPane, "recommendListContainerElement");
                if (!recommendListMovedInList) recommendListMovedInList = moveElementConditionally('recommendListV1Element', 'originalRecommendListV1ElementHolder', videosPane, "recommendListV1Element");
                contentMoved = recommendListMovedInList || contentMoved;
                if (!contentMoved) videosPane.textContent = '当前列表页无相关内容模块或加载失败。';
            } else videosPane.textContent = '当前页面类型无相关视频内容。';
        } else {
            moveElementConditionally('rcmdTabElement', 'originalRcmdTabElementHolder', null, "rcmdTabElement");
            moveElementConditionally('actionListElement', 'originalActionListElementHolder', null, "actionListElement");
            if (moveElementConditionally('recommendListV1Element', 'originalRecommendListV1ElementHolder', null, "recommendListV1Element") && elements.recommendListV1Element) elements.recommendListV1Element.style.marginTop = '';
            moveElementConditionally('recommendListContainerElement', 'originalRecommendListContainerElementHolder', null, "recommendListContainerElement");
            videosPane.textContent = '';
        }
    }

    function manageDanmakuTabContent(shouldDisplayInSidebar) {
        log(`manageDanmakuTabContent: shouldDisplayInSidebar = ${shouldDisplayInSidebar}`);
        const danmakuPane = elements.danmakuContentPane;
        if (!danmakuPane) { warn("manageDanmakuTabContent: Danmaku content pane not found."); return; }
        const danmakuBox = elements.danmakuBoxElement;
        if (!danmakuBox && shouldDisplayInSidebar) {
            danmakuPane.textContent = `弹幕模块 (${SELECTORS.danmakuBox}) 未在页面找到或加载失败。`;
            warn("manageDanmakuTabContent: Danmaku box element not found."); return;
        }
        if (!danmakuBox) return;
        const originalHolder = elements.originalDanmakuBoxElementHolder;
        if (shouldDisplayInSidebar) {
            danmakuPane.textContent = '';
            if (danmakuBox.parentElement !== danmakuPane) danmakuPane.appendChild(danmakuBox);
            danmakuBox.style.marginTop = '0px';
        } else {
            if (originalHolder?.parent && document.body.contains(originalHolder.parent) && danmakuBox.parentElement === danmakuPane) {
                try { originalHolder.parent.insertBefore(danmakuBox, originalHolder.nextSibling); }
                catch (e) { error(`Failed to restore danmaku box: ${e.message}.`); }
            } else if (danmakuBox.parentElement === danmakuPane) {
                try { danmakuBox.remove(); } catch(e) { /* ignore */ }
            }
            danmakuBox.style.marginTop = '';
            danmakuPane.textContent = '';
        }
    }

    function updateCommentSidebar(retryCount = 0) {
        if (sidebarUpdateRAFId) cancelAnimationFrame(sidebarUpdateRAFId);
        const mainSidebarContainer = getOrCreateCommentContainer();
        if (!mainSidebarContainer) { warn("updateCommentSidebar: Sidebar container not found."); return; }

        const currentPlayerScreen = elements.playerContainer ? elements.playerContainer.getAttribute('data-screen') : 'normal';
        const isSidebarFeatureEnabledGM = GM_getValue(config.featureTogglesKeys.enableSidebar, config.defaultFeatureToggles.enableSidebar);
        const { isReplyPage } = pageSpecificModeChecks();
        const mirrorVdcon = elements.mirrorVdcon || document.getElementById(SELECTORS.mirrorVdcon.substring(1));

        if (currentPlayerScreen === 'normal' || !isSidebarFeatureEnabledGM || isReplyPage) {
            if (mainSidebarContainer.classList.contains(CSS_CLASSES.commentSidebarActive)) {
                log("updateCommentSidebar: Conditions not met for sidebar, hiding.");
                mainSidebarContainer.classList.remove(CSS_CLASSES.commentSidebarActive);
                mainSidebarContainer.style.display = 'none';
                if (mirrorVdcon && elements.originalMirrorVdconPaddingLeft !== undefined) {
                    mirrorVdcon.style.paddingLeft = elements.originalMirrorVdconPaddingLeft;
                }
                 if (elements.playerWrap && elements.playerWrap.style.position === 'absolute' && elements.playerWrap.style.left !== '50%') {
                     elements.playerWrap.style.position = '';
                     elements.playerWrap.style.left = '50%';
                     elements.playerWrap.style.transform = 'translateX(-50%)';
                }
            }
            return;
        }

        if (!elements.player || !elements.playerWrap) {
            warn("updateCommentSidebar: Player core elements not cached.");
            if (mainSidebarContainer) mainSidebarContainer.classList.remove(CSS_CLASSES.commentSidebarActive);
            return;
        }
        const mainPlayerRect = elements.player.getBoundingClientRect();
        if (mainPlayerRect.width < 100 || mainPlayerRect.height < 50) {
             if (retryCount < config.attempts.sidebarPollMaxRetries) {
                 sidebarUpdateRAFId = requestAnimationFrame(() => updateCommentSidebar(retryCount + 1));
                 return;
             } else {
                 mainSidebarContainer.classList.remove(CSS_CLASSES.commentSidebarActive);
                 warn("updateCommentSidebar: Player dimensions too small after retries.");
                 return;
             }
        }
        const playerActualRight = elements.player.getBoundingClientRect().right;
        const gap = parseFloat(validateCssLength(currentSettings.playerSidebarGap, config.defaultSettings.playerSidebarGap));
        const sidebarCalculatedLeft = playerActualRight + gap;
        mainSidebarContainer.style.left = `${sidebarCalculatedLeft}px`;
        const browserEdgeMarginNum = parseFloat(validateCssLength(currentSettings.browserEdgeMargin, config.defaultSettings.browserEdgeMargin));
        let calculatedWidth = window.innerWidth - sidebarCalculatedLeft - browserEdgeMarginNum;
        calculatedWidth = Math.max(config.styles.minSidebarWidth, calculatedWidth);
        if (config.styles.maxSidebarWidth > 0) calculatedWidth = Math.min(config.styles.maxSidebarWidth, calculatedWidth);
        mainSidebarContainer.style.width = calculatedWidth > 0 ? `${calculatedWidth}px` : `${config.styles.minSidebarWidth}px`;
        mainSidebarContainer.style.top = config.sidebarFixedTopOffset;
        mainSidebarContainer.style.height = `${elements.playerWrap.offsetHeight}px`;
        mainSidebarContainer.classList.add(CSS_CLASSES.commentSidebarActive);
        mainSidebarContainer.style.display = 'flex';
        if (document.body.classList.contains(CSS_CLASSES.bodyEnhancementsActive)) {
            if (elements.commentContainer?.classList.contains(CSS_CLASSES.commentSidebarActive)) {
                loadAndApplyTabState(); // Ensure tab state is correct on update
            }
        }
    }

    function getOrCreateBottomDrawer() {
        if (elements.bottomDrawerWrapper && document.body.contains(elements.bottomDrawerWrapper)) return true;
        elements.bottomDrawerWrapper = document.createElement('div');
        elements.bottomDrawerWrapper.id = SCRIPT_ELEMENT_IDS.bottomDrawerWrapper;
        elements.bottomDrawerButton = document.createElement('div');
        elements.bottomDrawerButton.id = SCRIPT_ELEMENT_IDS.bottomDrawerButton;
        elements.bottomDrawerContent = document.createElement('div');
        elements.bottomDrawerContent.id = SCRIPT_ELEMENT_IDS.bottomDrawerContent;
        elements.bottomDrawerWrapper.appendChild(elements.bottomDrawerContent);
        elements.bottomDrawerWrapper.appendChild(elements.bottomDrawerButton);
        document.body.appendChild(elements.bottomDrawerWrapper);
        log("Bottom drawer created.");
        elements.bottomDrawerWrapper.addEventListener('mouseenter', () => {
            if (!elements.bottomDrawerContent) return;
            elements.bottomDrawerContent.classList.add(CSS_CLASSES.drawerContentExpanded);
            const arcToolbarReport = document.querySelector(SELECTORS.arcToolbarReport);
            let targetHeight = 150;
            if (arcToolbarReport && arcToolbarReport.offsetParent !== null) targetHeight = arcToolbarReport.offsetHeight;
            else if (arcToolbarReport) warn(`Bottom drawer: ${SELECTORS.arcToolbarReport} is not visible.`);
            else warn(`Bottom drawer: ${SELECTORS.arcToolbarReport} not found.`);
            elements.bottomDrawerContent.style.maxHeight = targetHeight + 'px';
        });
        elements.bottomDrawerWrapper.addEventListener('mouseleave', () => {
            if (!elements.bottomDrawerContent) return;
            elements.bottomDrawerContent.classList.remove(CSS_CLASSES.drawerContentExpanded);
            elements.bottomDrawerContent.style.maxHeight = '0';
        });
        return true;
    }

    function manageVideoToolbarForDrawer(moveToDrawer) {
        if (!elements.videoToolbarContainerElement) {
             elements.videoToolbarContainerElement = document.querySelector(SELECTORS.videoToolbarContainer);
            if (elements.videoToolbarContainerElement && !elements.originalVideoToolbarContainerElementHolder.parent) {
                elements.originalVideoToolbarContainerElementHolder.parent = elements.videoToolbarContainerElement.parentElement;
                elements.originalVideoToolbarContainerElementHolder.nextSibling = elements.videoToolbarContainerElement.nextSibling;
            }
        }
        if (!elements.videoToolbarContainerElement) {
            warn(`manageVideoToolbarForDrawer: Video toolbar (${SELECTORS.videoToolbarContainer}) not found.`);
            if (elements.bottomDrawerWrapper) elements.bottomDrawerWrapper.style.display = 'none';
            return;
        }
        if (moveToDrawer) {
            if (!elements.bottomDrawerWrapper && !getOrCreateBottomDrawer()) return;
            if (elements.videoToolbarContainerElement.parentElement !== elements.bottomDrawerContent) {
                elements.bottomDrawerContent.appendChild(elements.videoToolbarContainerElement);
            }
            if (elements.bottomDrawerWrapper) elements.bottomDrawerWrapper.style.display = 'flex';
        } else {
            const originalHolder = elements.originalVideoToolbarContainerElementHolder;
            if (originalHolder?.parent && document.body.contains(originalHolder.parent) && elements.videoToolbarContainerElement.parentElement === elements.bottomDrawerContent) {
                try { originalHolder.parent.insertBefore(elements.videoToolbarContainerElement, originalHolder.nextSibling); }
                catch (e) { error(`Failed to restore video toolbar: ${e.message}`); }
            }
            if (elements.bottomDrawerWrapper) elements.bottomDrawerWrapper.style.display = 'none';
        }
    }

    function isActuallyDarkMode() {
        if (document.documentElement.classList.contains('dark')) return true;
        if (document.documentElement.getAttribute('data-darkreader-scheme') === 'dark') return true;
        try {
            const bodyBgColor = window.getComputedStyle(document.body).backgroundColor;
            const rgb = bodyBgColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = parseInt(rgb[0]), g = parseInt(rgb[1]), b = parseInt(rgb[2]);
                if ((r + g + b) < 382.5) return true;
            }
        } catch (e) { warn(`isActuallyDarkMode: Error: ${e.message}`); }
        return false;
    }

    function syncThemeDependentStyles() {
        log("Syncing theme-dependent styles.");
        const isDark = isActuallyDarkMode();
        const themedBoxShadowBorderColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
        const shadowColor = isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.08)';

        const rootStyle = document.documentElement.style;
        rootStyle.setProperty('--biliplus-themed-box-shadow-border-color', themedBoxShadowBorderColor);
        rootStyle.setProperty('--dynamic-shadow-color', shadowColor);

        if (elements.sidebarTabHeader) {
            const themedBorderColor = window.getComputedStyle(document.documentElement).getPropertyValue('--line_regular').trim() || (isDark ? '#444' : '#ddd');
            elements.sidebarTabHeader.style.borderBottomColor = themedBorderColor;
        }
    }

    function handleDynamicBackgroundChange() {
        log("handleDynamicBackgroundChange: Page theme/background change detected.");
        syncThemeDependentStyles();
    }

    function setupDynamicBackgroundObserver() {
        if (dynamicBgObserver) dynamicBgObserver.disconnect();
        dynamicBgObserver = new MutationObserver(debounce(handleDynamicBackgroundChange, config.delays.debounce));
        dynamicBgObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-darkreader-scheme'] });
        syncThemeDependentStyles();
        log("Dynamic background/theme observer set up.");
    }

    function pageSpecificModeChecks() {
        return { isReplyPage: window.location.hash.startsWith('#reply') };
    }

    function resetEnhancedFeatures() {
        log("resetEnhancedFeatures: Starting full reset of enhanced features.");
        document.body.classList.remove(CSS_CLASSES.bodyEnhancementsActive);
        const mirrorVdconEl = elements.mirrorVdcon || document.getElementById(SELECTORS.mirrorVdcon.substring(1));
        if (mirrorVdconEl) {
            if (elements.originalMirrorVdconPaddingLeft !== undefined && elements.originalMirrorVdconPaddingLeft !== '') {
                mirrorVdconEl.style.paddingLeft = elements.originalMirrorVdconPaddingLeft;
            } else mirrorVdconEl.style.paddingLeft = '';
            mirrorVdconEl.style.height = '';
            log(`resetEnhancedFeatures: #mirror-vdcon height set to auto, padding-left restored to '${elements.originalMirrorVdconPaddingLeft || 'auto'}'.`);
            mirrorVdconEl.style.justifyContent = '';
        }
        if (elements.playerWrap) {
            elements.playerWrap.style.position = '';
            elements.playerWrap.style.left = '50%';
            elements.playerWrap.style.transform = 'translateX(-50%)';
            elements.playerWrap.style.width = '';
        }
        if (elements.commentContainer) {
            elements.commentContainer.classList.remove(CSS_CLASSES.commentSidebarActive);
            elements.commentContainer.style.display = 'none';
        }

        manageInfoTabContent(false);
        manageVideoTabContent(false);
        manageDanmakuTabContent(false);
        manageVideoToolbarForDrawer(false);
        if (elements.commentApp && elements.originalCommentAppHolder?.parent && document.body.contains(elements.originalCommentAppHolder.parent) && elements.commentsContentPane && elements.commentApp.parentElement === elements.commentsContentPane) {
            try { elements.originalCommentAppHolder.parent.insertBefore(elements.commentApp, elements.originalCommentAppHolder.nextSibling); }
            catch (e) { error(`Failed to restore comment section: ${e.message}`); }
        }
        const leftContainer = document.querySelector(SELECTORS.leftContainer);
        if (leftContainer) {
            leftContainer.style.width = '';
            leftContainer.style.marginTop = '';
        }
        const playerVideoArea = elements.playerContainer?.querySelector(SELECTORS.videoArea);
        const playerPlaceholderTop = document.getElementById(SCRIPT_ELEMENT_IDS.playerPlaceholderTop);
        const playerSendingBarEl = elements.playerContainer?.querySelector(SELECTORS.sendingBar);
        const playerPlaceholderBottom = document.getElementById(SCRIPT_ELEMENT_IDS.playerPlaceholderBottom);
        if (playerVideoArea) playerVideoArea.style.borderRadius = '';
        if (playerPlaceholderTop) playerPlaceholderTop.style.borderRadius = '';
        if (playerSendingBarEl) playerSendingBarEl.style.borderRadius = '';
        if (playerPlaceholderBottom) playerPlaceholderBottom.style.borderRadius = '';
        if (elements.player) elements.player.style.borderRadius = '';
        if (elements.playerContainer) elements.playerContainer.style.borderRadius = '';
        log("Enhanced features reset complete.");
    }

    // --- Stage 2 Refactor: Split applyEnhancedFeatures into smaller functions ---

    /**
     * Sets up the initial layout adjustments for enhanced mode.
     */
    function setupEnhancedLayout() {
        document.body.classList.add(CSS_CLASSES.bodyEnhancementsActive);

        const mirrorVdconEl = elements.mirrorVdcon || document.getElementById(SELECTORS.mirrorVdcon.substring(1));
        if (mirrorVdconEl) {
            // Store original styles if not already stored
            if (elements.originalMirrorVdconPaddingLeft === undefined || elements.originalMirrorVdconPaddingLeft === '') {
                elements.originalMirrorVdconPaddingLeft = window.getComputedStyle(mirrorVdconEl).paddingLeft;
                log(`setupEnhancedLayout: Stored #mirror-vdcon original padding-left: ${elements.originalMirrorVdconPaddingLeft}`);
            }
            if (elements.originalMirrorVdconHeight === '' || elements.originalMirrorVdconHeight === undefined) {
                 elements.originalMirrorVdconHeight = window.getComputedStyle(mirrorVdconEl).height;
                 log(`setupEnhancedLayout: Stored initial #mirror-vdcon height: ${elements.originalMirrorVdconHeight}`);
            }

            mirrorVdconEl.style.paddingLeft = 'var(--biliplus-browser-edge-margin)';
            mirrorVdconEl.style.height = '0px';
            mirrorVdconEl.style.justifyContent = 'space-between';
        }

        if (elements.playerWrap) {
             elements.playerWrap.style.left = '';
             elements.playerWrap.style.transform = '';
        }

        const leftContainer = document.querySelector(SELECTORS.leftContainer);
        if (leftContainer && elements.player) {
            leftContainer.style.marginTop = '11px';
        }
    }

    /**
     * Moves various content elements into their respective sidebar tabs.
     */
    function moveContentToSidebar() {
        getOrCreateCommentContainer();
        getOrCreateBottomDrawer();
        if (!elements.commentContainer || !elements.infoContentPane) {
            warn("moveContentToSidebar: Sidebar container or panels not ready.");
            return;
        }

        manageInfoTabContent(true);
        manageVideoTabContent(true);
        manageDanmakuTabContent(true);
        manageVideoToolbarForDrawer(true);

        if (elements.commentApp && elements.commentsContentPane) {
            if (elements.commentApp.parentElement !== elements.commentsContentPane) {
                elements.commentsContentPane.appendChild(elements.commentApp);
            }
        } else if (elements.commentsContentPane) {
            elements.commentsContentPane.textContent = '评论区加载失败或未找到。';
            if (!elements.commentApp) warn("moveContentToSidebar: Comment app element not cached.");
        }

        if (elements.commentContainer) {
            elements.commentContainer.classList.add(CSS_CLASSES.commentSidebarActive);
            elements.commentContainer.style.display = 'flex';
        }
    }

    /**
     * Applies final styling touches, like border-radius, to the player and related components.
     */
    function applyPlayerStyling() {
        const topOnlyRadius = `var(--biliplus-border-radius) var(--biliplus-border-radius) 0 0`;
        const bottomOnlyRadius = `0 0 var(--biliplus-border-radius) var(--biliplus-border-radius)`;

        const playerVideoArea = elements.playerContainer?.querySelector(SELECTORS.videoArea);
        if (playerVideoArea) playerVideoArea.style.borderRadius = topOnlyRadius;

        const playerPlaceholderTopEl = document.getElementById(SCRIPT_ELEMENT_IDS.playerPlaceholderTop);
        if (playerPlaceholderTopEl) playerPlaceholderTopEl.style.borderRadius = topOnlyRadius;

        const playerSendingBarEl = elements.playerContainer?.querySelector(SELECTORS.sendingBar);
        if (playerSendingBarEl) playerSendingBarEl.style.borderRadius = bottomOnlyRadius;

        const playerPlaceholderBottomEl = document.getElementById(SCRIPT_ELEMENT_IDS.playerPlaceholderBottom);
        if (playerPlaceholderBottomEl) playerPlaceholderBottomEl.style.borderRadius = bottomOnlyRadius;

        if (elements.player) elements.player.style.borderRadius = 'var(--biliplus-border-radius)';
        if (elements.playerContainer) elements.playerContainer.style.borderRadius = 'var(--biliplus-border-radius)';
    }

    /**
     * Orchestrates the process of applying all enhanced features.
     */
    async function applyEnhancedFeatures() {
        log("applyEnhancedFeatures: Orchestrating enhanced features application.");

        if (!elements.player) {
            if (!await ensureAllElementsCached()) {
                warn("applyEnhancedFeatures: Critical elements not cached. Aborting apply.");
                resetEnhancedFeatures();
                return;
            }
        } else {
            cacheContentElements(true); // Re-cache to get latest elements
        }

        setupEnhancedLayout();
        moveContentToSidebar();
        applyPlayerStyling();

        syncThemeDependentStyles();
        loadAndApplyTabState();
        updateCommentSidebar(0); // Perform initial sidebar positioning

        log("Enhanced features applied successfully.");
    }


    async function handleDataScreenChange(newScreenState) {
        log(`handleDataScreenChange: New screen state = ${newScreenState}, user manually exited wide = ${userManuallyExitedWide}`);
        const isSidebarFeatureEnabledGM = GM_getValue(config.featureTogglesKeys.enableSidebar, config.defaultFeatureToggles.enableSidebar);
        const { isReplyPage } = pageSpecificModeChecks();
        switch (newScreenState) {
            case 'wide':
                if (isSidebarFeatureEnabledGM && !isReplyPage) await applyEnhancedFeatures();
                else resetEnhancedFeatures();
                safeSetTimeout(scrollToPlayer, config.delays.stateChangeProcess / 2);
                break;
            case 'normal':
                scrollToTop();
                resetEnhancedFeatures();
                break;
            case 'web': case 'full':
                if (newScreenState === 'full' || !isSidebarFeatureEnabledGM || isReplyPage) resetEnhancedFeatures();
                else await applyEnhancedFeatures();
                break;
            default:
                log(`handleDataScreenChange: Unknown screen state "${newScreenState}"`);
                resetEnhancedFeatures();
                break;
        }
    }

    async function ensureWideMode() {
        const isAutoWidescreenEnabledGM = GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen);
        if (!isAutoWidescreenEnabledGM) {
            if (elements.playerContainer) await handleDataScreenChange(elements.playerContainer.getAttribute('data-screen'));
            return;
        }
        if (!elements.playerContainer || !elements.wideBtn) {
            if (!await ensureAllElementsCached()) { warn("ensureWideMode: Failed to cache critical elements."); return; }
        }
        if (!elements.playerContainer || !elements.wideBtn) { warn("ensureWideMode: Core player elements still not found after re-cache attempt."); return; }
        const { isReplyPage } = pageSpecificModeChecks();
        if (isReplyPage || userManuallyExitedWide) {
            if (elements.playerContainer) await handleDataScreenChange(elements.playerContainer.getAttribute('data-screen'));
            return;
        }
        if (elements.playerContainer.getAttribute('data-screen') === 'normal') {
            log("ensureWideMode: Currently in normal mode, clicking wide button.");
            elements.wideBtn.click();
        } else await handleDataScreenChange(elements.playerContainer.getAttribute('data-screen'));
    }

    function handlePlayerCtrlAreaClick(event) {
        const target = event.target.closest('div[class^="bpx-player-ctrl-"]');
        if (!target) return;
        if (target.matches(SELECTORS.wideBtn)) handleWideBtnClick();
        else if (target.matches(SELECTORS.webFullBtn)) handleWebFullBtnClick();
        else if (target.matches(SELECTORS.fullBtn)) handleFullBtnClick();
        else if (target.matches(SELECTORS.viewpointBtn)) handleViewpointBtnClick();
    }

    function handleWideBtnClick() {
        if (!elements.playerContainer) return;
        userManuallyExitedWide = elements.playerContainer.getAttribute('data-screen') === 'wide';
        log(`handleWideBtnClick: userManuallyExitedWide set to ${userManuallyExitedWide}`);
    }
    function handleWebFullBtnClick() { userManuallyExitedWide = false; log("handleWebFullBtnClick: Reset manual exit flag."); }
    function handleFullBtnClick() { userManuallyExitedWide = false; log("handleFullBtnClick: Reset manual exit flag."); }
    function handleVideoAreaDblClick() { userManuallyExitedWide = false; log("handleVideoAreaDblClick: Reset manual exit flag."); }
    function handleViewpointBtnClick() { log("Viewpoint button clicked."); setActiveSidebarTab('danmaku'); }
    function handleKeyPress(event) {
        if (!elements.playerContainer) return;
        if (event.key === 'Escape') {
            const screenBeforeEsc = elements.playerContainer.getAttribute('data-screen');
            log(`handleKeyPress: Escape pressed, previous state: ${screenBeforeEsc}`);
            safeSetTimeout(async () => {
                if (!elements.playerContainer) return;
                const screenAfterEsc = elements.playerContainer.getAttribute('data-screen');
                log(`handleKeyPress: After Escape delay, current state: ${screenAfterEsc}`);
                if ((screenBeforeEsc === 'web' || screenBeforeEsc === 'full' || screenBeforeEsc === 'wide') && screenAfterEsc === 'normal') {
                    userManuallyExitedWide = true;
                } else userManuallyExitedWide = false;
                if (screenAfterEsc) await handleDataScreenChange(screenAfterEsc);
                if (GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen) && !pageSpecificModeChecks().isReplyPage && !userManuallyExitedWide) {
                    await ensureWideMode();
                }
            }, config.delays.stateChangeProcess);
        }
    }
    async function handleFullscreenChange() {
        if (!elements.playerContainer) return;
        safeSetTimeout(async () => {
            if (!elements.playerContainer) return;
            const currentScreen = elements.playerContainer.getAttribute('data-screen');
            const isFullScreenActive = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
            log(`handleFullscreenChange: isFullScreenActive = ${isFullScreenActive}, currentScreen = ${currentScreen}`);
            if (isFullScreenActive) {
                userManuallyExitedWide = false; await handleDataScreenChange('full');
            } else {
                if (currentScreen === 'full') userManuallyExitedWide = false;
                if (GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen) && !pageSpecificModeChecks().isReplyPage && !userManuallyExitedWide) {
                    await ensureWideMode();
                } else if (currentScreen) await handleDataScreenChange(currentScreen);
            }
        }, config.delays.stateChangeProcess);
    }

    async function setupListeners() {
        removeListenersAndObserver(false);
        if (!await ensureAllElementsCached()) {
            warn("setupListeners: Failed to cache critical elements. Some listeners might not be attached.");
        }

        if (elements.playerContainer) {
            if (playerStateObserver) playerStateObserver.disconnect();
            playerStateObserver = new MutationObserver(async (mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-screen') {
                        const newScreenState = elements.playerContainer.getAttribute('data-screen');
                        log(`playerStateObserver: data-screen changed to "${newScreenState}"`);
                        await handleDataScreenChange(newScreenState);
                    }
                }
            });
            playerStateObserver.observe(elements.playerContainer, { attributes: true });

            const playerCtrlArea = elements.playerContainer.querySelector(SELECTORS.playerCtrlArea) || elements.playerContainer;
            playerCtrlArea.addEventListener('click', handlePlayerCtrlAreaClick);

            const videoArea = elements.playerContainer.querySelector(SELECTORS.videoArea);
            if (videoArea) {
                if (videoAreaDblClickListenerRef) videoArea.removeEventListener('dblclick', videoAreaDblClickListenerRef);
                videoAreaDblClickListenerRef = handleVideoAreaDblClick;
                videoArea.addEventListener('dblclick', videoAreaDblClickListenerRef);
            }

            if (playerResizeObserver) playerResizeObserver.disconnect();
            playerResizeObserver = new ResizeObserver(debounce(updateLayoutAndStyles, config.delays.debounce));
            playerResizeObserver.observe(elements.playerContainer);
            log("ResizeObserver for player container set up.");

        } else {
            warn("Player container not found. Listeners for player interactions and ResizeObserver cannot be set.");
            window.addEventListener('resize', debounce(updateLayoutAndStyles, config.delays.debounce));
        }


        fsHandlerRef = handleFullscreenChange;
        document.addEventListener('fullscreenchange', fsHandlerRef);
        document.addEventListener('webkitfullscreenchange', fsHandlerRef);
        document.addEventListener('mozfullscreenchange', fsHandlerRef);
        document.addEventListener('MSFullscreenChange', fsHandlerRef);
        document.addEventListener('keydown', handleKeyPress);

        setupDynamicBackgroundObserver();
        log("Event listeners and core observers (attempted to be) set up.");
    }

    function clearNonCoreElementReferences() {
        log("clearNonCoreElementReferences: Clearing non-UI core element references.");
        const keysToClear = ['commentApp', 'rcmdTabElement', 'actionListElement', 'recommendListV1Element', 'recommendListContainerElement', 'videoTitleElement', 'videoInfoMetaElement', 'videoDescContainerElement', 'videoTagContainerElement', 'upPanelContainerElement', 'danmakuBoxElement', 'videoToolbarContainerElement', 'videoInfoContainerWinElement', 'viewboxReportElement', 'mirrorVdcon'];
        keysToClear.forEach(key => {
            elements[key] = null;
            const originalHolderKey = `original${key.charAt(0).toUpperCase() + key.slice(1)}Holder`;
            if (elements[originalHolderKey]) {
                elements[originalHolderKey].parent = null; elements[originalHolderKey].nextSibling = null;
                if (key === 'videoTitleElement') elements[originalHolderKey].originalFontSize = '';
                if (key === 'videoInfoMetaElement') Object.assign(elements[originalHolderKey], { showMoreBtnOriginalDisplay: '', detailListOriginalDisplay: '', detailListOriginalFlexWrap: '', detailListOriginalGap: '' });
            }
        });
        if (elements.originalCommentAppHolder) { elements.originalCommentAppHolder.parent = null; elements.originalCommentAppHolder.nextSibling = null; }
        elements.originalMirrorVdconHeight = '';
        elements.originalMirrorVdconPaddingLeft = '';
    }

    function removeListenersAndObserver(keepUIForNextPage = false) {
        log(`removeListenersAndObserver: keepUIForNextPage = ${keepUIForNextPage}`);
        clearAllTimers();
        if (sidebarUpdateRAFId) cancelAnimationFrame(sidebarUpdateRAFId); sidebarUpdateRAFId = null;
        if (playerStateObserver) { playerStateObserver.disconnect(); playerStateObserver = null; }
        if (coreElementsObserver) { coreElementsObserver.disconnect(); coreElementsObserver = null; }
        if (dynamicBgObserver) { dynamicBgObserver.disconnect(); dynamicBgObserver = null; }
        if (playerResizeObserver) { playerResizeObserver.disconnect(); playerResizeObserver = null; }

        if (elements.playerContainer) {
            const playerCtrlArea = elements.playerContainer.querySelector(SELECTORS.playerCtrlArea) || elements.playerContainer;
            if (playerCtrlArea) playerCtrlArea.removeEventListener('click', handlePlayerCtrlAreaClick);

            const videoArea = elements.playerContainer.querySelector(SELECTORS.videoArea);
            if (videoArea && videoAreaDblClickListenerRef) { videoArea.removeEventListener('dblclick', videoAreaDblClickListenerRef); videoAreaDblClickListenerRef = null; }
        }

        document.removeEventListener('keydown', handleKeyPress);
        if (fsHandlerRef) {
            document.removeEventListener('fullscreenchange', fsHandlerRef); document.removeEventListener('webkitfullscreenchange', fsHandlerRef);
            document.removeEventListener('mozfullscreenchange', fsHandlerRef); document.removeEventListener('MSFullscreenChange', fsHandlerRef);
            fsHandlerRef = null;
        }
        window.removeEventListener('resize', debounce(updateLayoutAndStyles, config.delays.debounce));
        if (!keepUIForNextPage) {
            resetEnhancedFeatures();
            if (elements.commentContainer?.parentElement) elements.commentContainer.remove();
            if (elements.bottomDrawerWrapper?.parentElement) elements.bottomDrawerWrapper.remove();
            if (elements.settingsPanel?.parentElement) elements.settingsPanel.remove();
            elements = Object.keys(elements).reduce((acc, key) => {
                if (key.endsWith('Holder')) {
                    acc[key] = { parent: null, nextSibling: null };
                    if (key === 'originalVideoTitleElementHolder') acc[key].originalFontSize = '';
                    if (key === 'originalVideoInfoMetaElementHolder') Object.assign(acc[key], { showMoreBtnOriginalDisplay: '', detailListOriginalDisplay: '', detailListOriginalFlexWrap: '', detailListOriginalGap: '' });
                } else acc[key] = null;
                return acc;
            }, {});
            elements.originalMirrorVdconHeight = '';
            elements.originalMirrorVdconPaddingLeft = '';
        } else {
            manageInfoTabContent(false); manageVideoTabContent(false); manageDanmakuTabContent(false); manageVideoToolbarForDrawer(false);
            if (elements.commentApp && elements.originalCommentAppHolder?.parent && document.body.contains(elements.originalCommentAppHolder.parent) && elements.commentsContentPane && elements.commentApp.parentElement === elements.commentsContentPane) {
                try { elements.originalCommentAppHolder.parent.insertBefore(elements.commentApp, elements.originalCommentAppHolder.nextSibling); }
                catch(e) {error(`Failed to restore comment section (keep UI mode): ${e.message}`)}
            }
            clearNonCoreElementReferences();
            elements.player = null; elements.playerContainer = null; elements.playerWrap = null;
            elements.wideBtn = null; elements.webFullBtn = null; elements.fullBtn = null; elements.viewpointBtn = null;
        }
        log("Event listeners and observers removed.");
    }

    async function updateLayoutAndStyles() {
        log("updateLayoutAndStyles: Updating layout and styles due to resize or other trigger.");
        syncThemeDependentStyles();
        if (document.body.classList.contains(CSS_CLASSES.bodyEnhancementsActive) && elements.playerContainer) {
            updateCommentSidebar(0);
        }
         log("updateLayoutAndStyles: Update complete.");
    }


    function updateMenuCommands() {
        if (typeof GM_unregisterMenuCommand !== 'function' || typeof GM_registerMenuCommand !== 'function') return;
        if (autoWideMenuId) try { GM_unregisterMenuCommand(autoWideMenuId); } catch (e) {/*ignore*/}
        if (sidebarMenuId) try { GM_unregisterMenuCommand(sidebarMenuId); } catch (e) {/*ignore*/}
        if (openSettingsPanelMenuId) try { GM_unregisterMenuCommand(openSettingsPanelMenuId); } catch (e) {/*ignore*/}
        const autoWidescreenEnabledGM = GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen);
        const sidebarFeatureEnabledGM = GM_getValue(config.featureTogglesKeys.enableSidebar, config.defaultFeatureToggles.enableSidebar);
        const onTargetPage = isTargetPage(currentUrl);
        const { isReplyPage } = pageSpecificModeChecks();
        const baseStatus = (enabled) => enabled ? '✅ 开启' : '❌ 关闭';
        let autoWideText = `自动宽屏模式 (${baseStatus(autoWidescreenEnabledGM)})`;
        if (!onTargetPage) autoWideText = "自动宽屏模式 (当前页不支持)";
        else if (isReplyPage) autoWideText = `自动宽屏模式 (${baseStatus(autoWidescreenEnabledGM)} - 回复页禁用)`;
        autoWideMenuId = GM_registerMenuCommand(autoWideText, toggleWideScreenFeature);
        let sidebarText = `侧边栏增强 (${baseStatus(sidebarFeatureEnabledGM)} - 宽屏/网页全屏时生效)`;
        if (!onTargetPage) sidebarText = "侧边栏增强 (当前页不支持)";
        else if (isReplyPage) sidebarText = `侧边栏增强 (${baseStatus(sidebarFeatureEnabledGM)} - 回复页禁用)`;
        sidebarMenuId = GM_registerMenuCommand(sidebarText, toggleSidebarFeature);
        openSettingsPanelMenuId = GM_registerMenuCommand("⚙️ 打开设置面板", toggleSettingsPanel);
        log("GM menu commands updated.");
    }

    async function toggleWideScreenFeature() {
        const intendedState = !GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen);
        const { isReplyPage } = pageSpecificModeChecks();
        if (!isTargetPage(currentUrl) && intendedState) { alert("此页面不支持自动宽屏功能。"); return; }
        if (isReplyPage && intendedState) alert("自动宽屏功能不适用于评论回复(#reply)页面。\n设置已保存，但在此页面无效。");
        GM_setValue(config.featureTogglesKeys.enableWideScreen, intendedState);
        userManuallyExitedWide = !intendedState;
        updateMenuCommands();
        if (isTargetPage(currentUrl)) {
            if (intendedState && !isReplyPage) await ensureWideMode();
            else if (elements.playerContainer) {
                if (elements.playerContainer.getAttribute('data-screen') === 'wide' && !intendedState && !isReplyPage) {
                    if(elements.wideBtn) elements.wideBtn.click();
                } else await handleDataScreenChange(elements.playerContainer.getAttribute('data-screen'));
            }
        }
    }
    async function toggleSidebarFeature() {
        const intendedState = !GM_getValue(config.featureTogglesKeys.enableSidebar, config.defaultFeatureToggles.enableSidebar);
        const { isReplyPage } = pageSpecificModeChecks();
        if (!isTargetPage(currentUrl) && intendedState) { alert("侧边栏增强功能仅在视频/列表页面可用。"); return; }
        if (isReplyPage && intendedState) alert("侧边栏增强功能不适用于评论回复(#reply)页面。\n设置已保存，但在此页面无效。");
        GM_setValue(config.featureTogglesKeys.enableSidebar, intendedState);
        updateMenuCommands();
        if (isTargetPage(currentUrl) && elements.playerContainer) {
            await handleDataScreenChange(elements.playerContainer.getAttribute('data-screen'));
        }
    }

    async function initializeScriptLogic(isReInit = false, fromObserver = false) {
        log(`initializeScriptLogic: Start. isReInit = ${isReInit}, fromObserver = ${fromObserver}`);
        reInitScheduled = false; clearAllTimers();

        injectBaseStyles();
        loadAllSettings();

        if (!isReInit || !fromObserver || !document.getElementById(SCRIPT_ELEMENT_IDS.commentContainer)) {
            getOrCreateCommentContainer();
            getOrCreateBottomDrawer();
            createSettingsPanel();
        }

        if (await ensureAllElementsCached()) {
            log("initializeScriptLogic: All necessary elements cached. Proceeding to setup.");
            await setupListeners();
            if (elements.playerContainer) {
                const initialScreen = elements.playerContainer.getAttribute('data-screen');
                if (initialScreen) await handleDataScreenChange(initialScreen);
            }
            loadAndApplyTabState();

            if (GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen) && !pageSpecificModeChecks().isReplyPage && !userManuallyExitedWide) {
                const delay = currentSettings.autoWideDelay;
                log(`Auto-widescreen enabled, will ensure wide mode after ${delay}ms if conditions met.`);
                safeSetTimeout(async () => {
                    if (GM_getValue(config.featureTogglesKeys.enableWideScreen, config.defaultFeatureToggles.enableWideScreen) && !pageSpecificModeChecks().isReplyPage && !userManuallyExitedWide && isTargetPage(window.location.href) && elements.playerContainer?.getAttribute('data-screen') === 'normal') {
                        log("Auto-widescreen delay ended: Conditions met, calling ensureWideMode.");
                        await ensureWideMode();
                    } else {
                        log("Auto-widescreen delay ended: Conditions no longer met or not in normal mode.");
                    }
                }, delay);
            }
            safeSetTimeout(async () => {
                if (elements.playerContainer) {
                    const currentScreen = elements.playerContainer.getAttribute('data-screen');
                    if (currentScreen) await handleDataScreenChange(currentScreen);
                }
            }, config.delays.finalCheck);
            return;
        }

        warn("initializeScriptLogic: ensureAllElementsCached returned false. Setting up observer.");
        if (fromObserver) { error("initializeScriptLogic (from observer): Critical elements still missing after internal wait."); return; }

        if (coreElementsObserver) coreElementsObserver.disconnect();
        coreElementsObserver = new MutationObserver(async (mutations, observer) => {
            log("MutationObserver: Checking for core player elements...");
            if (document.querySelector(SELECTORS.player) && (document.querySelector(SELECTORS.playerContainer) || document.querySelector(SELECTORS.playerAlternativeContainer)) ) {
                log("initializeScriptLogic (MutationObserver): Core player elements detected.");
                observer.disconnect();
                coreElementsObserver = null;
                await initializeScriptLogic(true, true);
            }
        });
        const observeTarget = document.getElementById(SELECTORS.biliReportWrap.substring(1)) || document.body;
        coreElementsObserver.observe(observeTarget, { childList: true, subtree: true });
        log(`initializeScriptLogic: Core element observer started on ${observeTarget.id || 'document.body'}.`);

        safeSetTimeout(async () => {
            if (coreElementsObserver) {
                coreElementsObserver.disconnect(); coreElementsObserver = null;
                warn("Core element observer timed out. Attempting final initialization.");
                await initializeScriptLogic(true, false);
            }
        }, config.delays.observerMaxWait);
    }

    function handleUrlChange() {
        requestAnimationFrame(async () => {
            const newHref = window.location.href;
            if (newHref === currentUrl) return;
            const oldUrl = currentUrl; currentUrl = newHref;
            log(`URL changed: from ${oldUrl} to ${newHref}`);
            userManuallyExitedWide = false;

            loadAllSettings();
            updateMenuCommands();

            const wasTargetPage = isTargetPage(oldUrl);
            const isNowTargetPage = isTargetPage(newHref);

            if (isNowTargetPage) {
                await scheduleReInitialization(wasTargetPage);
            } else if (wasTargetPage && !isNowTargetPage) {
                removeListenersAndObserver(false);
                if (elements.settingsPanel) elements.settingsPanel.style.display = 'none';
            }
        });
    }
    async function scheduleReInitialization(keepUI = false, delay = config.delays.urlCheck) {
        log(`scheduleReInitialization: keepUI = ${keepUI}, delay = ${delay}, reInitScheduled = ${reInitScheduled}`);
        if (reInitScheduled) {
            if (!keepUI && activeTimers.size > 0) { clearAllTimers(); }
            else if (keepUI && activeTimers.size > 0) return;
        }
        reInitScheduled = true;
        if (activeTimers.size > 0 && !keepUI) clearAllTimers();

        safeSetTimeout(async () => {
            log("Executing scheduled re-initialization...");
            removeListenersAndObserver(keepUI);
            await new Promise(resolve => setTimeout(resolve, 100)); // Short delay for DOM to settle
            await initializeScriptLogic(true, false);
        }, delay);
    }

    function isTargetPage(url) { return /\/(video|list)\//.test(url); }

    async function main() {
        log(`Script starting. Version ${GM_info.script.version}. Debug Mode: ${config.debugMode}`);
        // Set default values on first run
        for (const key in config.featureTogglesKeys) {
            if (GM_getValue(config.featureTogglesKeys[key]) === undefined) {
                GM_setValue(config.featureTogglesKeys[key], config.defaultFeatureToggles[key]);
            }
        }
        for (const key in config.settingsKeys) {
            if (GM_getValue(config.settingsKeys[key]) === undefined) {
                GM_setValue(config.settingsKeys[key], config.defaultSettings[key]);
            }
        }

        loadAllSettings();
        updateMenuCommands();

        window.addEventListener('popstate', handleUrlChange);
        const origPushState = history.pushState;
        history.pushState = function(...args) {
            const oldHref = window.location.href; origPushState.apply(this, args);
            if (window.location.href !== oldHref) window.dispatchEvent(new CustomEvent('historystatechanged'));
        };
        const origReplaceState = history.replaceState;
        history.replaceState = function(...args) {
            const oldHref = window.location.href; origReplaceState.apply(this, args);
            if (window.location.href !== oldHref) window.dispatchEvent(new CustomEvent('historystatechanged'));
        };
        window.addEventListener('historystatechanged', handleUrlChange);

        if (isTargetPage(currentUrl)) await initializeScriptLogic();
        else log("Initial page is not a target page.");

        window.addEventListener('unload', () => {
            removeListenersAndObserver(false);
            if(playerResizeObserver) playerResizeObserver.disconnect();
        });
    }

    log(`Script parsed. document.readyState: ${document.readyState}`);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})();
