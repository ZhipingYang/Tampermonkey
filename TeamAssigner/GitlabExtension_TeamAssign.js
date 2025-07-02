// ==UserScript==
// @name         GitLab Team Assigner
// @namespace    https://www.ringcentral.com
// @version      1.1.5
// @description  Automatically add team members as reviewers to GitLab Merge Requests
// @author       Daniel Yang
// @include      https://git.ringcentral.com/*/-/merge_requests/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @updateURL    https://git.ringcentral.com/daniel.yang/gitlabextension_teamassign/-/raw/main/TeamAssigner/GitlabExtension_TeamAssign.js
// @downloadURL  https://git.ringcentral.com/daniel.yang/gitlabextension_teamassign/-/raw/main/TeamAssigner/GitlabExtension_TeamAssign.js
// ==/UserScript==

(function() {
    'use strict';

    // Versioned storage access - dynamically get version from UserScript metadata
    const SCRIPT_VERSION = GM_info.script.version;
    
    // Get versioned key name
    function getVersionedKey(key) {
        return `v${SCRIPT_VERSION}_${key}`;
    }

    // Versioned storage operations
    function setVersionedValue(key, value) {
        GM_setValue(getVersionedKey(key), value);
    }

    function getVersionedValue(key, defaultValue) {
        return GM_getValue(getVersionedKey(key), defaultValue);
    }

    // Logging system configuration
    function isLoggingEnabled() {
        return getVersionedValue('enableLogging', true); // Default enabled
    }

    function setLoggingEnabled(enabled) {
        setVersionedValue('enableLogging', enabled);
    }

    // Custom logging functions
    function logInfo(...args) {
        if (isLoggingEnabled()) {
            console.log(...args);
        }
    }

    function logWarn(...args) {
        if (isLoggingEnabled()) {
            console.warn(...args);
        }
    }

    function logError(...args) {
        // Error logs are always shown regardless of logging setting
        console.error(...args);
    }

    // Add theme support CSS
    GM_addStyle(`
        /* Global theme variables */
        :root {
            /* Light theme - Enhanced contrast */
            --tm-bg-color: var(--gl-theme-white, #ffffff);
            --tm-text-color: var(--gl-theme-text-color, #24292f);
            --tm-border-color: var(--gl-theme-border-color, #d0d7de);
            --tm-primary-color: var(--gl-theme-primary, #1f75cb);
            --tm-primary-hover: var(--gl-theme-primary-hover, #1968b3);
            --tm-secondary-color: var(--gl-theme-secondary, #656d76);
            --tm-secondary-hover: var(--gl-theme-secondary-hover, #4c535b);
            --tm-danger-color: var(--gl-theme-danger, #d73a49);
            --tm-danger-hover: var(--gl-theme-danger-hover, #b31d28);
            --tm-info-bg: var(--gl-theme-info-bg, #f6f8fa);
            
            /* Enhanced button contrast colors */
            --tm-button-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            --tm-button-text-shadow: 0 1px 1px rgba(0, 0, 0, 0.1);
        }

        /* Dark theme - Enhanced visibility */
        [data-theme="dark"],
        .gl-dark,
        html[data-color-mode="dark"],
        body[data-color-mode="dark"] {
            --tm-bg-color: var(--gl-theme-dark-bg, #0d1117);
            --tm-text-color: var(--gl-theme-dark-text, #f0f6fc);
            --tm-border-color: var(--gl-theme-dark-border, #30363d);
            --tm-primary-color: var(--gl-theme-dark-primary, #58a6ff);
            --tm-primary-hover: var(--gl-theme-dark-primary-hover, #79c0ff);
            --tm-secondary-color: var(--gl-theme-dark-secondary, #8b949e);
            --tm-secondary-hover: var(--gl-theme-dark-secondary-hover, #b1bac4);
            --tm-danger-color: var(--gl-theme-dark-danger, #f85149);
            --tm-danger-hover: var(--gl-theme-dark-danger-hover, #ff7b72);
            --tm-info-bg: var(--gl-theme-dark-info-bg, #161b22);
            
            /* Enhanced button contrast colors for dark theme */
            --tm-button-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
            --tm-button-text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
        }

        /* Button base styles - Enhanced visibility */
        .team-review-button,
        .team-selector-button,
        .team-management-button {
            transition: all 0.2s ease !important;
            border: 1px solid var(--tm-border-color) !important;
            font-weight: 600 !important;
            font-size: 12px !important;
            text-shadow: var(--tm-button-text-shadow) !important;
            box-shadow: var(--tm-button-shadow) !important;
            position: relative !important;
            overflow: hidden !important;
            border-radius: 4px !important;
        }

        /* Enhanced button visibility with better contrast */
        .team-review-button,
        .team-selector-button,
        .clear-reviewers-button {
            /* Ensure buttons are visible on all backgrounds */
            min-height: 28px !important;
            padding: 4px 8px !important;
            line-height: 1.4 !important;
        }

        /* Primary button styles - Enhanced */
        .team-review-button {
            background: linear-gradient(135deg, var(--tm-primary-color) 0%, var(--tm-primary-hover) 100%) !important;
            color: #ffffff !important;
            border-color: var(--tm-primary-color) !important;
        }
        .team-review-button:hover {
            background: linear-gradient(135deg, var(--tm-primary-hover) 0%, var(--tm-primary-color) 100%) !important;
            border-color: var(--tm-primary-hover) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
        }

        /* Selector button styles - Enhanced */
        .team-selector-button {
            background: linear-gradient(135deg, var(--tm-secondary-color) 0%, var(--tm-secondary-hover) 100%) !important;
            color: #ffffff !important;
            border-color: var(--tm-secondary-color) !important;
        }
        .team-selector-button:hover {
            background: linear-gradient(135deg, var(--tm-secondary-hover) 0%, var(--tm-secondary-color) 100%) !important;
            border-color: var(--tm-secondary-hover) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
        }



        /* Clear button styles - Enhanced */
        .clear-reviewers-button {
            background: linear-gradient(135deg, var(--tm-danger-color) 0%, var(--tm-danger-hover) 100%) !important;
            color: #ffffff !important;
            border-color: var(--tm-danger-color) !important;
        }
        .clear-reviewers-button:hover {
            background: linear-gradient(135deg, var(--tm-danger-hover) 0%, var(--tm-danger-color) 100%) !important;
            border-color: var(--tm-danger-hover) !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
        }

        /* Dark theme specific button enhancements */
        [data-theme="dark"] .team-review-button,
        .gl-dark .team-review-button,
        html[data-color-mode="dark"] .team-review-button,
        body[data-color-mode="dark"] .team-review-button {
            border-color: var(--tm-primary-hover) !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
        }

        [data-theme="dark"] .team-selector-button,
        .gl-dark .team-selector-button,
        html[data-color-mode="dark"] .team-selector-button,
        body[data-color-mode="dark"] .team-selector-button {
            border-color: var(--tm-secondary-hover) !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
        }

        [data-theme="dark"] .clear-reviewers-button,
        .gl-dark .clear-reviewers-button,
        html[data-color-mode="dark"] .clear-reviewers-button,
        body[data-color-mode="dark"] .clear-reviewers-button {
            border-color: var(--tm-danger-hover) !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
        }

        .team-management-ui {
            --tm-primary-hover: var(--gl-theme-primary-hover, #1968b3);
            --tm-danger-color: var(--gl-theme-danger, #dc3545);
            --tm-danger-hover: var(--gl-theme-danger-hover, #c82333);
            --tm-secondary-hover: var(--gl-theme-secondary-hover, #5a6268);
            --tm-success-color: var(--gl-theme-success, #28a745);
            --tm-success-hover: var(--gl-theme-success-hover, #218838);
            --tm-info-text: var(--gl-theme-info-text, #1976d2);
            --tm-warning-bg: var(--gl-theme-warning-bg, #fff3cd);
            --tm-warning-text: var(--gl-theme-warning-text, #856404);
            --tm-overlay-bg: rgba(0, 0, 0, 0.5);
        }

        .team-management-panel {
            background: var(--tm-bg-color);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-border-color);
            box-shadow: 0 8px 32px var(--tm-overlay-bg);
            position: relative;
        }

        /* Ensure proper spacing between title and close button */
        .team-management-panel h2 {
            margin: 0 60px 20px 0 !important;
            font-size: 24px !important;
            text-align: center !important;
            color: var(--tm-text-color) !important;
            padding-right: 20px !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
        }

        .team-management-button {
            background: var(--tm-primary-color);
            color: var(--tm-bg-color);
            border: 1px solid var(--tm-border-color);
        }

        .team-management-button:hover {
            background: var(--tm-primary-hover);
        }

        /* Enhanced menu button layout */
        .team-management-button {
            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
            text-align: left !important;
        }

        .team-management-button .menu-icon {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            margin-right: 12px !important;
            font-size: 16px !important;
            width: 20px !important;
            height: 20px !important;
            flex-shrink: 0 !important;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3) !important;
        }

        .team-management-button .menu-text {
            flex: 1 !important;
            font-size: 14px !important;
            font-weight: 500 !important;
            letter-spacing: 0.25px !important;
        }

        /* Dark theme emoji enhancement */
        [data-theme="dark"] .menu-icon,
        .gl-dark .menu-icon,
        html[data-color-mode="dark"] .menu-icon,
        body[data-color-mode="dark"] .menu-icon {
            text-shadow: 0 0 3px rgba(255, 255, 255, 0.3), 0 1px 2px rgba(0, 0, 0, 0.8) !important;
            filter: brightness(1.2) contrast(1.1) !important;
        }

        .team-management-input {
            background: var(--tm-bg-color);
            color: var(--tm-text-color);
            border: 1px solid var(--tm-border-color);
        }

        .team-management-info {
            background: var(--tm-info-bg);
            color: var(--tm-info-text);
        }

        .team-management-warning {
            background: var(--tm-warning-bg);
            color: var(--tm-warning-text);
        }

        /* Close button specific styles */
        .team-management-close-button {
            position: absolute !important;
            top: 16px !important;
            right: 20px !important;
            background: transparent !important;
            border: none !important;
            font-size: 20px !important;
            cursor: pointer !important;
            color: var(--tm-text-color) !important;
            width: 28px !important;
            height: 28px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 1001 !important;
            transition: all 0.2s ease !important;
            font-weight: bold !important;
            line-height: 1 !important;
            font-family: inherit !important;
        }

        .team-management-close-button:hover {
            background: var(--tm-danger-color) !important;
            color: white !important;
            transform: scale(1.1) !important;
        }

        .team-management-close-button:active {
            transform: scale(0.95) !important;
        }

        /* Additional accessibility and visibility improvements */
        .team-review-button,
        .team-selector-button,
        .team-menu-button,
        .clear-reviewers-button {
            /* Force higher z-index to ensure visibility */
            z-index: 1000 !important;
            
            /* Ensure text is always readable */
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            
            /* Improve click area */
            cursor: pointer !important;
            
            /* Prevent text selection */
            user-select: none !important;
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            
            /* Better focus visibility */
            outline: none !important;
        }

        /* Focus states for accessibility */
        .team-review-button:focus,
        .team-selector-button:focus,
        .clear-reviewers-button:focus {
            outline: 2px solid var(--tm-primary-color) !important;
            outline-offset: 2px !important;
        }

        /* High contrast mode support */
        @media (prefers-contrast: high) {
            .team-review-button,
            .team-selector-button,
            .clear-reviewers-button {
                border-width: 2px !important;
                font-weight: 700 !important;
            }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
            .team-review-button,
            .team-selector-button,
            .clear-reviewers-button {
                transition: none !important;
                transform: none !important;
            }
        }

        /* Ensure buttons work in GitLab's various container contexts */
        .right-sidebar .team-review-button,
        .right-sidebar .team-selector-button,
        .right-sidebar .clear-reviewers-button,
        .issuable-sidebar .team-review-button,
        .issuable-sidebar .team-selector-button,
        .issuable-sidebar .clear-reviewers-button {
            margin: 2px !important;
            display: inline-block !important;
            vertical-align: middle !important;
        }
    `);

    // Team member username to ID mapping (base mapping)
    const BASE_USER_ID_MAP = {
        'daniel.yang': 1397,
        'lawrence.huang': 2191,
        'noah.wu': 2261,
        'daosong.xu': 2467,
        'tyson.cai': 2472,
        'karmiy.hong': 5160,
        'charles.zhang': 5241,
        'davis.huang': 2800
    };

    // Get complete user ID mapping (base + dynamic cache)
    function getUserIdMap() {
        const dynamicMap = getVersionedValue('dynamicUserIdMap', '{}');
        const parsedDynamicMap = JSON.parse(dynamicMap);
        return { ...BASE_USER_ID_MAP, ...parsedDynamicMap };
    }

    // Save dynamically obtained user ID to cache
    function saveDynamicUserId(username, userId) {
        const dynamicMap = getVersionedValue('dynamicUserIdMap', '{}');
        const parsedDynamicMap = JSON.parse(dynamicMap);
        parsedDynamicMap[username] = userId;
        setVersionedValue('dynamicUserIdMap', JSON.stringify(parsedDynamicMap));
        logInfo(`GitLab Team Assigner: 💾 Cached user ID: ${username} -> ${userId}`);
    }

    // Clear dynamic user ID cache
    function clearDynamicUserIdCache() {
        setVersionedValue('dynamicUserIdMap', '{}');
        logInfo('GitLab Team Assigner: 🗑️ Dynamic user ID cache cleared');
    }

    // Default team configuration
    const DEFAULT_TEAMS = {
        'Fiji_Titan': {
            members: [
                'charles.zhang',
                'lawrence.huang',
                'daniel.yang',
                'noah.wu',
                'tyson.cai',
                'karmiy.hong',
                'daosong.xu',
                'deepak.sharma',
                'davis.huang'
            ],
            projectRules: ['Fiji/Fiji']
        },
        'mThor_iOS': {
            members: [
                'daniel.yang',
                'will.wei',
                'jerold.liu',
                'eden.qu',
                'bk.suresh'
            ],
            projectRules: ['CoreLib/mthor']
        },
        'mThor_iOS & CoreLib': {
            members: [
                'daniel.yang',
                'will.wei',
                'jerold.liu',
                'eden.qu',
                'bk.suresh',
                'jed.wu',
                'olivia.xu',
                'johngu.zhong'
            ],
            projectRules: ['CoreLib/mthor']
        },
        'Default': {
            members: ['daniel.yang'],
            projectRules: []
        }

    };

    // Get project path
    function getProjectPath() {
        // Extract project path from URL, supports full git.ringcentral.com format
        const pathMatch = window.location.pathname.match(/\/([^/-]+\/[^/-]+)\//);
        return pathMatch ? pathMatch[1] : '';
    }

    // Get priority team for project path
    function getPriorityTeamForProject(projectPath) {
        if (!projectPath) return null;
        
        const allTeams = getAllTeams();
        for (const [teamName, teamConfig] of Object.entries(allTeams)) {
            // Check if team has project rule configuration
            if (teamConfig.projectRules && teamConfig.projectRules.length > 0) {
                // Check each project rule
                for (const rule of teamConfig.projectRules) {
                    if (projectPath.toLowerCase().includes(rule.toLowerCase())) {
                        return teamName;
                    }
                }
            }
        }
        return null;
    }

    // Get currently selected team name
    function getCurrentTeamName() {
        // 1. Check if there's a project-specific forced selection
        const forcedTeam = getProjectForcedTeam();
        if (forcedTeam) {
            logInfo(`GitLab Team Assigner: Using project forced team: ${forcedTeam}`);
            return forcedTeam;
        }

        // 2. Check project rule matching
        const projectPath = getProjectPath();
        const allTeams = getAllTeams();
        for (const [teamName, team] of Object.entries(allTeams)) {
            if (team.projectRules && team.projectRules.some(rule => {
                const regex = new RegExp(rule.replace(/\*/g, '.*'));
                return regex.test(projectPath);
            })) {
                logInfo(`GitLab Team Assigner: Project rule matched team: ${teamName}`);
                return teamName;
            }
        }

        // 3. Use default team
        const defaultTeam = GM_getValue('defaultTeam', Object.keys(allTeams)[0]);
        logInfo(`GitLab Team Assigner: Using default team: ${defaultTeam}`);
        return defaultTeam;
    }

    // Save currently selected team name
    function saveCurrentTeamName(teamName, isForced = false) {
        if (isForced) {
            saveProjectForcedTeam(teamName);
        } else {
            GM_setValue('defaultTeam', teamName);
        }
    }

    // Get all team configurations
    function getAllTeams() {
        const saved = getVersionedValue('allTeams', '');
        if (saved) {
            return JSON.parse(saved);
        }
        return DEFAULT_TEAMS;
    }

    // Save all team configurations
    function saveAllTeams(teams) {
        setVersionedValue('allTeams', JSON.stringify(teams));
    }

    // Get current team members
    function getTeamMembers() {
        const currentTeamName = getCurrentTeamName();
        const allTeams = getAllTeams();
        return allTeams[currentTeamName]?.members || [];
    }

    // Save team members to current team
    function saveTeamMembers(members) {
        const currentTeamName = getCurrentTeamName();
        const allTeams = getAllTeams();
        if (!allTeams[currentTeamName]) {
            allTeams[currentTeamName] = { members: [], projectRules: [] };
        }
        allTeams[currentTeamName].members = members;
        saveAllTeams(allTeams);
    }

    // Create team management UI interface
    function createTeamManagementUI() {
        // Remove existing management interface
        const existingUI = document.getElementById('team-management-ui');
        if (existingUI) {
            existingUI.remove();
        }

        // Create main container
        const overlay = document.createElement('div');
        overlay.id = 'team-management-ui';
        overlay.className = 'team-management-ui';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: var(--tm-overlay-bg);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(2px);
        `;

        // Create management panel
        const panel = document.createElement('div');
        panel.className = 'team-management-panel';
        panel.style.cssText = `
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;

        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Team Management';
        title.style.cssText = `
            margin: 0 50px 20px 0;
            font-size: 24px;
            text-align: center;
            color: var(--tm-text-color);
            padding-right: 20px;
            box-sizing: border-box;
        `;

        // Create close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'team-management-close-button';
        closeBtn.style.cssText = `
            position: absolute !important;
            top: 12px !important;
            right: 16px !important;
            background: transparent !important;
            border: none !important;
            font-size: 24px !important;
            cursor: pointer !important;
            color: var(--tm-text-color) !important;
            width: 32px !important;
            height: 32px !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            z-index: 1001 !important;
            transition: all 0.2s ease !important;
            font-weight: bold !important;
            line-height: 1 !important;
        `;
        closeBtn.addEventListener('click', () => overlay.remove());
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'var(--tm-danger-color) !important';
            closeBtn.style.color = 'white !important';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'transparent !important';
            closeBtn.style.color = 'var(--tm-text-color) !important';
        });

        // Create menu container
        const menuContainer = document.createElement('div');
        menuContainer.id = 'menu-container';

        panel.appendChild(title);
        panel.appendChild(closeBtn);
        panel.appendChild(menuContainer);
        overlay.appendChild(panel);

        // Show main menu
        showMainMenu(menuContainer);

        document.body.appendChild(overlay);

        // Click background to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });
    }

    // Create menu button with enhanced layout
    function createMenuButton(iconOrText, textOrOnClick, onClickOrStyle = {}, style = {}) {
        const button = document.createElement('button');
        button.className = 'team-management-button';
        
        // Handle different parameter patterns for backward compatibility
        let icon, text, onClick, buttonStyle;
        if (typeof textOrOnClick === 'string') {
            // New pattern: createMenuButton(icon, text, onClick, style)
            icon = iconOrText;
            text = textOrOnClick;
            onClick = onClickOrStyle;
            buttonStyle = style;
        } else {
            // Old pattern: createMenuButton(text, onClick, style)
            icon = '';
            text = iconOrText;
            onClick = textOrOnClick;
            buttonStyle = onClickOrStyle;
        }
        
        // Create button content with proper spacing
        if (icon) {
            button.innerHTML = `
                <span class="menu-icon" style="
                    display: inline-block;
                    margin-right: 12px;
                    font-size: 16px;
                    vertical-align: middle;
                    width: 20px;
                    text-align: center;
                ">${icon}</span>
                <span class="menu-text" style="
                    vertical-align: middle;
                    font-size: 14px;
                ">${text}</span>
            `;
        } else {
            button.textContent = text;
        }
        
        button.style.cssText = `
            display: flex;
            align-items: center;
            width: 100%;
            padding: 12px 16px;
            margin: 8px 0;
            background: var(--tm-primary-color);
            color: var(--tm-bg-color);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            text-align: left;
            transition: background 0.2s;
            line-height: 1.4;
            ${Object.entries(buttonStyle).map(([k, v]) => `${k}: ${v}`).join('; ')}
        `;

        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            if (!buttonStyle.background) button.style.background = 'var(--tm-primary-hover)';
        });
        button.addEventListener('mouseleave', () => {
            if (!buttonStyle.background) button.style.background = 'var(--tm-primary-color)';
        });

        return button;
    }

    // Create back button
    function createBackButton(onClick) {
        return createMenuButton('⬅️', 'Back to Main Menu', onClick, {
            background: 'var(--tm-secondary-color)',
            marginBottom: '16px'
        });
    }

    // Show message prompt
    function showMessage(container, message, type = 'info') {
        // Remove existing message
        const existingMessage = container.querySelector('.team-management-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'team-management-message';
        
        const colors = {
            success: { bg: 'var(--tm-success-color, #28a745)', text: 'white' },
            error: { bg: 'var(--tm-danger-color)', text: 'white' },
            info: { bg: 'var(--tm-info-bg)', text: 'var(--tm-text-color)' }
        };
        
        const color = colors[type] || colors.info;
        
        messageDiv.style.cssText = `
            background: ${color.bg};
            color: ${color.text};
            padding: 12px 16px;
            border-radius: 6px;
            margin: 16px 0;
            text-align: center;
            font-weight: 500;
            animation: fadeIn 0.3s ease;
        `;
        
        messageDiv.textContent = message;
        container.insertBefore(messageDiv, container.firstChild);
        
        // Add CSS animation
        if (!document.querySelector('#team-message-style')) {
            const style = document.createElement('style');
            style.id = 'team-message-style';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Show main menu
    function showMainMenu(container) {
        container.innerHTML = '';

        const menuItems = [
            { icon: '🌟', text: 'View All Teams', action: () => showAllTeams(container) },
            { icon: '✨', text: 'Create New Team', action: () => showCreateTeam(container) },
            { icon: '💎', text: 'View User ID Cache', action: () => showUserIdCache(container) },
            { icon: '🔥', text: 'Clear Cache', action: () => showClearCache(container) },
            { icon: '⚡', text: 'Logging Settings', action: () => showLoggingSettings(container) }
        ];

        menuItems.forEach(item => {
            const button = createMenuButton(item.icon, item.text, item.action);
            container.appendChild(button);
        });
    }

    // Show all teams
    function showAllTeams(container) {
        container.innerHTML = '';
        
        const allTeams = getAllTeams();
        Object.entries(allTeams).forEach(([teamName, teamConfig]) => {
            const teamDiv = document.createElement('div');
            teamDiv.className = 'team-management-info';
            teamDiv.style.cssText = `
                margin-bottom: 10px;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
            `;
            
            const rulesText = teamConfig.projectRules.length > 0 
                ? `<br><span style="color: var(--tm-info-text); font-size: 12px;">🎯 Project rules: ${teamConfig.projectRules.join(', ')}</span>`
                : '';
                
            teamDiv.innerHTML = `
                <strong>${teamName}</strong> (${teamConfig.members.length} members)<br>
                <span style="color: var(--tm-text-color); font-size: 13px;">${teamConfig.members.join(', ')}</span>
                ${rulesText}
            `;
            container.appendChild(teamDiv);

            teamDiv.addEventListener('click', () => showEditTeam(container, teamName));
        });

        // Back button
        container.appendChild(createBackButton(() => showMainMenu(container)));
    }

    // Show create team interface
    function showCreateTeam(container) {
        container.innerHTML = '';

        // Create team name input
        const nameTitle = document.createElement('h3');
        nameTitle.textContent = 'Team Name';
        container.appendChild(nameTitle);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Enter team name';
        nameInput.style.width = '100%';
        nameInput.style.marginBottom = '20px';
        nameInput.style.padding = '8px';
        nameInput.style.borderRadius = '4px';
        nameInput.style.border = '1px solid var(--tm-border-color)';
        nameInput.style.background = 'var(--tm-bg-color)';
        nameInput.style.color = 'var(--tm-text-color)';
        container.appendChild(nameInput);

        // Create member input area
        const membersTitle = document.createElement('h3');
        membersTitle.textContent = 'Team Members';
        container.appendChild(membersTitle);

        const membersInfo = document.createElement('p');
        membersInfo.textContent = 'Enter one member username per line (supports newline, comma, space separation)';
        membersInfo.style.color = 'var(--tm-secondary-color)';
        container.appendChild(membersInfo);

        const membersTextarea = document.createElement('textarea');
        membersTextarea.style.width = '100%';
        membersTextarea.style.height = '100px';
        membersTextarea.style.marginBottom = '20px';
        container.appendChild(membersTextarea);

        // Create project rules input area
        const rulesTitle = document.createElement('h3');
        rulesTitle.textContent = 'Project Matching Rules';
        container.appendChild(rulesTitle);

        const rulesInfo = document.createElement('p');
        rulesInfo.innerHTML = 'One rule per line, format examples:<br>Fiji/Fiji<br>CoreLib/mthor';
        rulesInfo.style.color = 'var(--tm-secondary-color)';
        container.appendChild(rulesInfo);

        const rulesTextarea = document.createElement('textarea');
        rulesTextarea.style.width = '100%';
        rulesTextarea.style.height = '100px';
        rulesTextarea.style.marginBottom = '20px';
        container.appendChild(rulesTextarea);

        // Create button
        const createButton = createMenuButton('Create Team', () => {
            const teamName = nameInput.value.trim();
            const members = membersTextarea.value
                .split(/[\n,\s]+/)
                .map(m => m.trim())
                .filter(m => m);
            
            const rules = rulesTextarea.value
                .split('\n')
                .map(r => r.trim())
                .filter(r => r);

            if (!teamName) {
                alert('Please enter team name');
                return;
            }

            const allTeams = getAllTeams();
            if (allTeams[teamName]) {
                alert(`Team "${teamName}" already exists`);
                return;
            }

            if (members.length === 0) {
                alert('Please add at least one team member');
                return;
            }

            allTeams[teamName] = {
                members: members,
                projectRules: rules
            };
            saveAllTeams(allTeams);

            // Return directly to team list page
            showAllTeams(container);
        });
        container.appendChild(createButton);

        // Back button
        container.appendChild(createBackButton(() => showMainMenu(container)));
    }

    // Show edit team interface
    function showEditTeam(container, teamName) {
        container.innerHTML = '';
        
        const team = getAllTeams()[teamName];
        if (!team) {
            showMessage(container, 'Team not found', 'error');
            return;
        }

        // Create team name edit area
        const nameTitle = document.createElement('h3');
        nameTitle.textContent = 'Team Name';
        container.appendChild(nameTitle);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = teamName;
        nameInput.style.width = '100%';
        nameInput.style.marginBottom = '20px';
        nameInput.style.padding = '8px';
        nameInput.style.borderRadius = '4px';
        nameInput.style.border = '1px solid var(--tm-border-color)';
        nameInput.style.background = 'var(--tm-bg-color)';
        nameInput.style.color = 'var(--tm-text-color)';
        container.appendChild(nameInput);

        // Create member edit area
        const membersTitle = document.createElement('h3');
        membersTitle.textContent = 'Team Members';
        container.appendChild(membersTitle);

        const membersInfo = document.createElement('p');
        membersInfo.textContent = 'Supports newline, comma, space separation (can be mixed)';
        membersInfo.style.color = 'var(--tm-secondary-color)';
        membersInfo.style.fontSize = '13px';
        membersInfo.style.margin = '0 0 8px 0';
        container.appendChild(membersInfo);

        const membersTextarea = document.createElement('textarea');
        membersTextarea.value = team.members.join('\n');
        membersTextarea.style.width = '100%';
        membersTextarea.style.height = '100px';
        membersTextarea.style.marginBottom = '20px';
        container.appendChild(membersTextarea);

        // Create project rules edit area
        const rulesTitle = document.createElement('h3');
        rulesTitle.textContent = 'Project Matching Rules';
        container.appendChild(rulesTitle);

        const rulesInfo = document.createElement('p');
        rulesInfo.innerHTML = 'One rule per line, format examples:<br>Fiji/Fiji<br>CoreLib/mthor';
        rulesInfo.style.color = 'var(--tm-secondary-color)';
        container.appendChild(rulesInfo);

        const rulesTextarea = document.createElement('textarea');
        rulesTextarea.value = team.projectRules.join('\n');
        rulesTextarea.style.width = '100%';
        rulesTextarea.style.height = '100px';
        rulesTextarea.style.marginBottom = '20px';
        container.appendChild(rulesTextarea);

        // Button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.marginBottom = '20px';

        // Save button
        const saveButton = createMenuButton('Save', () => {
            const newName = nameInput.value.trim();
            const members = membersTextarea.value
                .split(/[\n,\s]+/)
                .map(m => m.trim())
                .filter(m => m);

            const rules = rulesTextarea.value
                .split('\n')
                .map(r => r.trim())
                .filter(r => r);

            // Validate new team name
            if (!newName) {
                alert('Team name cannot be empty');
                return;
            }

            if (members.length === 0) {
                alert('Please add at least one team member');
                return;
            }

            const allTeams = getAllTeams();

            // If team name has changed
            if (newName !== teamName) {
                // Check if new name already exists
                if (newName !== teamName && allTeams[newName]) {
                    alert(`Team name "${newName}" already exists`);
                    return;
                }

                // Delete old team, create new team
                delete allTeams[teamName];
                
                // If it's the currently selected team, update the selected team name
                if (getCurrentTeamName() === teamName) {
                    saveCurrentTeamName(newName);
                }
            }

            // Save team configuration
            allTeams[newName] = {
                members: members,
                projectRules: rules
            };
            saveAllTeams(allTeams);

            // Return directly to team list page
            showAllTeams(container);
        });
        buttonContainer.appendChild(saveButton);

        // Delete button
        const deleteButton = createMenuButton('Delete Team', () => {
            if (confirm(`Are you sure you want to delete team "${teamName}"? This operation cannot be undone.`)) {
                const allTeams = getAllTeams();
                delete allTeams[teamName];
                saveAllTeams(allTeams);

                // If deleting the currently selected team, switch to the first available team
                if (getCurrentTeamName() === teamName) {
                    const firstTeamName = Object.keys(allTeams)[0] || 'Default';
                    saveCurrentTeamName(firstTeamName);
                }

                // Return directly to team list page
                showAllTeams(container);
            }
        }, { background: 'var(--tm-danger-color)' });
        buttonContainer.appendChild(deleteButton);

        container.appendChild(buttonContainer);

        // Back button
        container.appendChild(createBackButton(() => showAllTeams(container)));
    }

    // Show user ID cache
    function showUserIdCache(container) {
        container.innerHTML = '';
        
        const userIdMap = getUserIdMap();
        const dynamicMap = JSON.parse(getVersionedValue('dynamicUserIdMap', '{}'));
        
        // Show base mapping
        const baseTitle = document.createElement('h3');
        baseTitle.textContent = 'Base User ID Mapping';
        container.appendChild(baseTitle);

        const baseList = document.createElement('div');
        baseList.style.marginBottom = '20px';
        Object.entries(BASE_USER_ID_MAP).forEach(([username, id]) => {
            const item = document.createElement('div');
            item.textContent = `${username}: ${id}`;
            baseList.appendChild(item);
        });
        container.appendChild(baseList);

        // Show dynamic cache
        const cacheTitle = document.createElement('h3');
        cacheTitle.textContent = 'Dynamically Cached User IDs';
        container.appendChild(cacheTitle);

        if (Object.keys(dynamicMap).length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.textContent = 'No dynamically cached user IDs';
            emptyMsg.style.color = 'var(--tm-secondary-color)';
            container.appendChild(emptyMsg);
        } else {
            const cacheList = document.createElement('div');
            Object.entries(dynamicMap).forEach(([username, id]) => {
                const item = document.createElement('div');
                item.textContent = `${username}: ${id}`;
                cacheList.appendChild(item);
            });
            container.appendChild(cacheList);
        }

        // Back button
        container.appendChild(createBackButton(() => showMainMenu(container)));
    }

    // Show clear cache confirmation
    function showClearCache(container) {
        container.innerHTML = '';
        container.appendChild(createBackButton(() => showMainMenu(container)));

        const title = document.createElement('h3');
        title.textContent = 'Clear User ID Cache';
        title.style.margin = '0 0 16px 0';
        container.appendChild(title);

        const warning = document.createElement('div');
        warning.className = 'team-management-warning';
        warning.innerHTML = `
            <strong>⚠️ Warning</strong><br>
            This will delete all user ID mappings dynamically obtained through the search API.<br>
            Base mappings will not be affected.<br><br>
            After clearing, these users will need to be searched again to obtain IDs.
        `;

        const dynamicMap = GM_getValue('dynamicUserIdMap', '{}');
        const parsedDynamicMap = JSON.parse(dynamicMap);
        const cacheCount = Object.keys(parsedDynamicMap).length;

        const info = document.createElement('div');
        info.className = 'team-management-info';
        info.textContent = `Current dynamic cache: ${cacheCount} user IDs`;

        const clearBtn = createMenuButton(
            '⭕',
            `Confirm Clear (${cacheCount} items)`,
            () => {
                clearDynamicUserIdCache();
                alert('User ID cache cleared');
                showMainMenu(container);
            },
            { background: 'var(--tm-danger-color)' }
        );

        if (cacheCount === 0) {
            clearBtn.disabled = true;
            clearBtn.style.background = 'var(--tm-secondary-color)';
            clearBtn.textContent = 'No cache to clear';
        }

        container.appendChild(warning);
        container.appendChild(info);
        container.appendChild(clearBtn);
    }

    // Show logging settings
    function showLoggingSettings(container) {
        container.innerHTML = '';
        container.appendChild(createBackButton(() => showMainMenu(container)));

        const title = document.createElement('h3');
        title.textContent = 'Logging Settings';
        title.style.margin = '0 0 16px 0';
        container.appendChild(title);

        const currentStatus = isLoggingEnabled();
        
        const info = document.createElement('div');
        info.className = 'team-management-info';
        info.innerHTML = `
            <strong>📝 Current Status:</strong> ${currentStatus ? 'Enabled' : 'Disabled'}<br><br>
            When logging is enabled, detailed debug information will be output to the browser console.<br>
            When logging is disabled, only error messages will be shown.<br><br>
            <strong>Note:</strong> Error logs are always displayed regardless of this setting.
        `;
        container.appendChild(info);

        // Toggle button
        const toggleBtn = createMenuButton(
            currentStatus ? '🔴' : '🟢',
            currentStatus ? 'Disable Logging' : 'Enable Logging',
            () => {
                const newStatus = !isLoggingEnabled();
                setLoggingEnabled(newStatus);
                showMessage(container, `Logging ${newStatus ? 'enabled' : 'disabled'}`, 'success');
                // Refresh the display
                setTimeout(() => showLoggingSettings(container), 1000);
            },
            { 
                background: currentStatus ? 'var(--tm-danger-color)' : 'var(--tm-success-color, #28a745)',
                marginBottom: '20px'
            }
        );
        container.appendChild(toggleBtn);

        // Test logging button
        const testBtn = createMenuButton(
            '🔬',
            'Test Logging',
            () => {
                logInfo('GitLab Team Assigner: 🔬 Test info log - this should only appear if logging is enabled');
                logWarn('GitLab Team Assigner: 🔬 Test warning log - this should only appear if logging is enabled');
                logError('GitLab Team Assigner: 🔬 Test error log - this should always appear');
                showMessage(container, 'Test logs sent to console (F12 to view)', 'info');
            },
            { background: 'var(--tm-info-text, #1976d2)' }
        );
        container.appendChild(testBtn);
    }

    // Manage team configuration - use new UI interface
    function manageTeams() {
        createTeamManagementUI();
    }

    // Quick edit current team members
    function configureTeamMembers() {
        const currentTeamName = getCurrentTeamName();
        const currentMembers = getTeamMembers();
        const availableMembers = Object.keys(getUserIdMap()).join(', ');

        const newMembersInput = prompt(
            `Edit team "${currentTeamName}" members:\n` +
            `Supported formats: newline, comma, space separated (can be mixed)\n\n` +
            `Current members: ${currentMembers.join(', ')}\n\n` +
            `Known members: ${availableMembers}\n\n` +
            `💡 Tip: For more management features, use the "Team Management" menu`,
            currentMembers.join(' ')
        );

        if (newMembersInput !== null) {
            const newMembers = newMembersInput
                .split(/[\n,\s]+/)
                .map(name => name.trim())
                .filter(name => name);

            saveTeamMembers(newMembers);
            alert(`Team "${currentTeamName}" updated successfully!\nNew members: ${newMembers.join(', ')}`);

            // Reinitialize buttons to update display
            setTimeout(() => {
                document.querySelector('.team-review-button')?.remove();
                document.querySelector('.team-selector-button')?.remove();
                initTeamAssigner();
            }, 100);
        }
    }

    // Register menu commands
    GM_registerMenuCommand('Team Management', manageTeams);

    // Create team review button
    function createTeamReviewButton() {
        const button = document.createElement('button');
        button.textContent = `Add ${getCurrentTeamName()} (${getTeamMembers().length})`;
        button.className = 'btn btn-default btn-sm gl-button team-review-button';
        button.style.cssText = `
            margin-left: 8px;
            padding: 6px 12px;
            font-size: 12px;
        `;
        button.addEventListener('click', addTeamReviewers);
        return button;
    }

    // Create team selector button
    function createTeamSelectorButton() {
        const button = document.createElement('button');
        button.textContent = '▼';
        button.className = 'btn btn-default btn-sm gl-button team-selector-button';
        button.style.cssText = `
            margin-left: 4px;
            padding: 6px 8px;
            font-size: 12px;
        `;
        button.addEventListener('click', showTeamSelector);
        return button;
    }

    // Show team selector
    function showTeamSelector() {
        const teamNames = Object.keys(getAllTeams());
        const currentTeamName = getCurrentTeamName();
        const currentProjectPath = getProjectPath();
        const forcedTeam = getProjectForcedTeam();

        const selector = document.createElement('div');
        selector.className = 'team-selector';
        selector.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: var(--tm-bg-color);
            color: var(--tm-text-color);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 90%;
            width: 400px;
            border: 1px solid var(--tm-border-color);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Select Team';
        title.style.cssText = `
            margin-top: 0;
            margin-bottom: 16px;
            color: var(--tm-text-color);
            font-size: 18px;
        `;
        selector.appendChild(title);

        // Add description text
        const info = document.createElement('div');
        info.style.cssText = `
            color: var(--tm-secondary-color);
            font-size: 14px;
            margin-bottom: 16px;
            padding: 8px 12px;
            background: var(--tm-info-bg);
            border-radius: 4px;
            border: 1px solid var(--tm-border-color);
        `;
        
        // Display current project and team status
        const statusText = forcedTeam 
            ? `Current project ${currentProjectPath} is forced to use team: ${forcedTeam}`
            : `Current project ${currentProjectPath} uses automatic matching rules`;
            
        info.innerHTML = `
            ${statusText}<br><br>
            After selecting a team, it will only take effect for the current project<br>
            Other projects will still use their respective matching rules
        `;
        selector.appendChild(info);

        // Create team list container
        const teamList = document.createElement('div');
        teamList.style.cssText = `
            max-height: 800px;
            overflow-y: auto;
            padding-right: 4px;
        `;

        teamNames.forEach(teamName => {
            const team = getAllTeams()[teamName];
            const button = document.createElement('button');
            button.className = 'team-selector-option';
            const isCurrentTeam = teamName === currentTeamName;
            
            button.style.cssText = `
                display: block;
                width: 100%;
                padding: 12px;
                margin: 8px 0;
                border: 1px solid var(--tm-border-color);
                border-radius: 4px;
                background: ${isCurrentTeam ? 'var(--tm-primary-color)' : 'var(--tm-bg-color)'};
                color: ${isCurrentTeam ? 'white' : 'var(--tm-text-color)'};
                cursor: pointer;
                text-align: left;
                transition: all 0.2s ease;
                position: relative;
            `;

            // Add hover effect
            button.addEventListener('mouseover', () => {
                if (!isCurrentTeam) {
                    button.style.background = 'var(--tm-info-bg)';
                    button.style.borderColor = 'var(--tm-primary-color)';
                }
            });

            button.addEventListener('mouseout', () => {
                if (!isCurrentTeam) {
                    button.style.background = 'var(--tm-bg-color)';
                    button.style.borderColor = 'var(--tm-border-color)';
                }
            });

            // Team information
            const teamInfo = document.createElement('div');
            teamInfo.style.cssText = `
                margin-bottom: ${team.projectRules.length > 0 ? '8px' : '0'};
            `;
            teamInfo.innerHTML = `
                <strong style="font-size: 15px;">${teamName}</strong>
                <span style="color: ${isCurrentTeam ? 'rgba(255,255,255,0.8)' : 'var(--tm-secondary-color)'};">
                    (${team.members.length} members)
                </span>
            `;
            button.appendChild(teamInfo);

            // Project rules information
            if (team.projectRules.length > 0) {
                const rulesInfo = document.createElement('div');
                rulesInfo.style.cssText = `
                    font-size: 13px;
                    color: ${isCurrentTeam ? 'rgba(255,255,255,0.8)' : 'var(--tm-secondary-color)'};
                    background: ${isCurrentTeam ? 'rgba(255,255,255,0.1)' : 'var(--tm-info-bg)'};
                    padding: 4px 8px;
                    border-radius: 3px;
                    margin-top: 4px;
                `;
                rulesInfo.innerHTML = `🎯 ${team.projectRules.join(', ')}`;
                button.appendChild(rulesInfo);
            }

            // Current selection marker
            if (isCurrentTeam) {
                const checkmark = document.createElement('div');
                checkmark.style.cssText = `
                    position: absolute;
                    right: 12px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: white;
                    font-size: 16px;
                `;
                checkmark.textContent = '✓';
                button.appendChild(checkmark);
            }

            button.addEventListener('click', () => {
                saveCurrentTeamName(teamName, true); // Always use forced selection
                document.body.removeChild(selector);
                document.body.removeChild(overlay);

                // Update button text
                const reviewButton = document.querySelector('.team-review-button');
                if (reviewButton) {
                    reviewButton.textContent = `Add ${teamName} (${team.members.length})`;
                }
            });

            teamList.appendChild(button);
        });

        // Add button to clear forced selection
        if (forcedTeam) {
            const clearButton = document.createElement('button');
            clearButton.textContent = 'Clear forced selection, restore automatic matching';
            clearButton.style.cssText = `
                display: block;
                width: 100%;
                padding: 12px;
                margin: 16px 0 8px;
                background: var(--tm-danger-color);
                color: white;
                border: 1px solid var(--tm-border-color);
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s ease;
            `;

            clearButton.addEventListener('mouseover', () => {
                clearButton.style.background = 'var(--tm-danger-hover)';
            });

            clearButton.addEventListener('mouseout', () => {
                clearButton.style.background = 'var(--tm-danger-color)';
            });

            clearButton.addEventListener('click', () => {
                clearProjectForcedTeam();
                document.body.removeChild(selector);
                document.body.removeChild(overlay);

                // Update button text
                const reviewButton = document.querySelector('.team-review-button');
                if (reviewButton) {
                    const newTeamName = getCurrentTeamName();
                    const team = getAllTeams()[newTeamName];
                    reviewButton.textContent = `Add ${newTeamName} (${team.members.length})`;
                }
            });

            teamList.appendChild(clearButton);
        }

        selector.appendChild(teamList);

        // Add overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 9999;
            backdrop-filter: blur(2px);
        `;
        overlay.addEventListener('click', () => {
            document.body.removeChild(selector);
            document.body.removeChild(overlay);
        });

        document.body.appendChild(overlay);
        document.body.appendChild(selector);
    }

    // Get GitLab API information
    function getGitLabApiInfo() {
        // Extract project path and MR ID from URL
        const pathMatch = location.pathname.match(/^\/([^\/]+)\/([^\/]+)\/-\/merge_requests\/(\d+)/);
        if (!pathMatch) {
            throw new Error('Cannot parse GitLab URL');
        }

        const [, namespace, project, mrId] = pathMatch;

        // Get CSRF token
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ||
                         document.querySelector('input[name="authenticity_token"]')?.value;

        if (!csrfToken) {
            throw new Error('Cannot get CSRF token');
        }

        return {
            namespace,
            project,
            mrId,
            csrfToken,
            baseUrl: `${location.protocol}//${location.host}`
        };
    }

    // Search user ID by username via API (strict mode)
    async function searchUserIdByUsername(username, apiInfo) {
        try {
            // Try to get project_id from the page, use default value if failed
            let projectId = '9729'; // default value

            // Try to get project_id from page's data attribute or meta tag
            const projectIdElement = document.querySelector('[data-project-id]') ||
                                   document.querySelector('meta[name="project-id"]') ||
                                   document.querySelector('[data-project]');

            if (projectIdElement) {
                projectId = projectIdElement.getAttribute('data-project-id') ||
                           projectIdElement.getAttribute('content') ||
                           projectIdElement.getAttribute('data-project') ||
                           projectId;
            }

            logInfo('GitLab Team Assigner: Using project_id:', projectId);

            const searchUrl = `${apiInfo.baseUrl}/-/autocomplete/users.json?search=${encodeURIComponent(username)}&active=true&project_id=${projectId}&current_user=true&merge_request_iid=${apiInfo.mrId}&approval_rules=true&show_suggested=true`;

            logInfo(`GitLab Team Assigner: 🔍 Searching user:`, searchUrl);

            const response = await fetch(searchUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                    'X-CSRF-Token': apiInfo.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`User search failed: ${response.status}`);
            }

            const users = await response.json();
            logInfo('GitLab Team Assigner: 🔍 Search results:', users);

            if (users.length === 0) {
                throw new Error(`User not found: ${username}`);
            }

            // Strict mode: must exactly match username
            const exactMatch = users.find(user => user.username === username);
            if (exactMatch) {
                logInfo(`GitLab Team Assigner: ✅ Exactly matched user ${username}, ID: ${exactMatch.id}`);
                // Cache dynamically obtained user ID
                saveDynamicUserId(username, exactMatch.id);
                return exactMatch.id;
            }

            // Strict mode: if no exact match, check if there's only one result with high similarity
            if (users.length === 1) {
                const user = users[0];
                // Check username similarity (simple inclusion check)
                if (user.username.toLowerCase().includes(username.toLowerCase()) ||
                    username.toLowerCase().includes(user.username.toLowerCase())) {
                    logWarn(`GitLab Team Assigner: ⚠️ Found similar user ${user.username} (searching for: ${username}), ID: ${user.id}`);
                    // Do not automatically cache similar matches, user confirmation needed
                    throw new Error(`Found similar user "${user.username}", but does not exactly match "${username}". Please use the exact username.`);
                }
            }

            // Multiple results or no exact match - considered failure in strict mode
            const userList = users.map(u => u.username).join(', ');
            throw new Error(`Search for "${username}" found ${users.length} results: ${userList}. Please use the exact username.`);

        } catch (error) {
            logError(`GitLab Team Assigner: ❌ User search failed (${username}):`, error);
            throw error;
        }
    }

    // Get user ID (smart way: prioritize mapping, otherwise search and cache)
    async function getUserId(username, apiInfo) {
        const userIdMap = getUserIdMap();

        // First check if it's in the mapping (base mapping + dynamic cache)
        if (userIdMap[username]) {
            const source = BASE_USER_ID_MAP[username] ? 'base mapping' : 'dynamic cache';
            logInfo(`GitLab Team Assigner: ✅ Got user ${username} from ${source}, ID: ${userIdMap[username]}`);
            return userIdMap[username];
        }

        // If not in mapping, search via API (strict mode, automatically caches on success)
        logInfo(`GitLab Team Assigner: 🔍 User ${username} not in mapping, starting strict search...`);
        return await searchUserIdByUsername(username, apiInfo);
    }

    // Get current MR's reviewer list
    async function getCurrentReviewers(apiInfo) {
        try {
            const response = await fetch(`${apiInfo.baseUrl}/${apiInfo.namespace}/${apiInfo.project}/-/merge_requests/${apiInfo.mrId}.json?serializer=sidebar_extras`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'X-CSRF-Token': apiInfo.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });

            if (!response.ok) {
                throw new Error(`Failed to get MR info: ${response.status}`);
            }

            const mrData = await response.json();
            return mrData.reviewers || [];
        } catch (error) {
            logError('GitLab Team Assigner: ❌ Failed to get current reviewers:', error);
            return [];
        }
    }

    // Dynamically update the visibility of the clear button
    async function updateClearButtonVisibility() {
        const clearButton = document.querySelector('.clear-reviewers-button');
        const hasReviewers = await hasExistingReviewers();
        
        if (hasReviewers && !clearButton) {
            // Need to show clear button but it doesn't exist - place it at the end
            const selectorButton = document.querySelector('.team-selector-button');
            if (selectorButton) {
                const newClearButton = createClearReviewersButton();
                newClearButton.classList.add('clear-reviewers-button');
                
                // Determine insertion method based on button's position type
                if (selectorButton.style.position === 'fixed') {
                    // Floating button - adjust position
                    newClearButton.style.position = 'fixed';
                    newClearButton.style.top = '100px';
                    newClearButton.style.right = '380px';
                    newClearButton.style.zIndex = '9999';
                    newClearButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                    document.body.appendChild(newClearButton);
                } else {
                    // Normal button - insert after selector button
                    selectorButton.parentNode.insertBefore(newClearButton, selectorButton.nextSibling);
                }
                logInfo('GitLab Team Assigner: ✅ Added clear button');
            }
        } else if (!hasReviewers && clearButton) {
            // Don't need to show clear button but it exists
            clearButton.remove();
            logInfo('GitLab Team Assigner: ✅ Removed clear button');
        }
    }

    // Add team reviewers (smart API way)
    async function addTeamReviewers() {
        const teamMembers = getTeamMembers();

        if (teamMembers.length === 0) {
            alert('Please configure team members first!');
            configureTeamMembers();
            return;
        }

        logInfo('GitLab Team Assigner: 🚀 Starting to add team reviewers smartly...');
        logInfo('GitLab Team Assigner: Configured team members:', teamMembers);

        try {
            // Get API info
            const apiInfo = getGitLabApiInfo();
            logInfo('GitLab Team Assigner: API info:', apiInfo);

            // Get current reviewers
            const currentReviewers = await getCurrentReviewers(apiInfo);
            logInfo('GitLab Team Assigner: Current reviewers:', currentReviewers);

            // Smartly get user IDs for all team members
            const teamMemberIds = [];
            const failedMembers = [];

            for (const username of teamMembers) {
                try {
                    const userId = await getUserId(username, apiInfo);
                    teamMemberIds.push(userId);
                } catch (error) {
                    logWarn(`GitLab Team Assigner: ⚠️ Skipping user ${username}:`, error.message);
                    failedMembers.push(username);
                }
            }

            logInfo('GitLab Team Assigner: Successfully obtained team member IDs:', teamMemberIds);

            if (failedMembers.length > 0) {
                logWarn('GitLab Team Assigner: ⚠️ Users not found:', failedMembers);
            }

            if (teamMemberIds.length === 0) {
                alert('No valid team member users found!');
                return;
            }

            // Get current reviewer IDs
            const currentReviewerIds = currentReviewers.map(reviewer => reviewer.id);
            logInfo('GitLab Team Assigner: Current reviewer IDs:', currentReviewerIds);

            // Merge existing reviewers with new team members, removing duplicates
            const allReviewerIds = [...new Set([...currentReviewerIds, ...teamMemberIds])];
            logInfo('GitLab Team Assigner: Merged reviewer IDs:', allReviewerIds);

            // If no new reviewers need to be added
            if (allReviewerIds.length === currentReviewerIds.length) {
                logInfo('GitLab Team Assigner: ℹ️ Team members are already reviewers!');
                return;
            }

            // Build request body (using correct format)
            const requestBody = {
                "merge_request": {
                    "reviewer_ids": allReviewerIds,
                    "suggested_reviewer_ids": []
                }
            };

            logInfo('GitLab Team Assigner: Sending request body:', requestBody);

            // Send API request to update reviewers
            const response = await fetch(`${apiInfo.baseUrl}/${apiInfo.namespace}/${apiInfo.project}/-/merge_requests/${apiInfo.mrId}.json?serializer=sidebar_extras`, {
                method: 'PUT',
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': apiInfo.csrfToken,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin',
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const responseData = await response.json();
            logInfo('GitLab Team Assigner: ✅ API response:', responseData);

            // Calculate number of newly added reviewers
            const newReviewersCount = allReviewerIds.length - currentReviewerIds.length;
            logInfo(`GitLab Team Assigner: ✅ Successfully added ${newReviewersCount} team members as reviewers!`);

            // Update clear button state
            await updateClearButtonVisibility();

            // Only show warning if there are failed users
            if (failedMembers.length > 0) {
                alert(`⚠️ The following users were not found: ${failedMembers.join(', ')}`);
            }

        } catch (error) {
            logError('GitLab Team Assigner: ❌ Failed to add team reviewers:', error);
            alert(`Failed to add team reviewers: ${error.message}`);
        }
    }

    // Check and inject team review button
    async function injectTeamReviewButton() {
        // If buttons already exist, don't add again
        if (document.querySelector('.team-review-button') || document.querySelector('.team-selector-button')) {
            return;
        }

        logInfo('GitLab Team Assigner: 🔍 Starting to find reviewer edit button...');

        // Original find logic
        const reviewerEditButton = document.querySelector('[data-testid="reviewer-edit-button"]') ||
                                  document.querySelector('.js-issuable-sidebar .js-reviewer-edit') ||
                                  document.querySelector('.reviewer .edit-link') ||
                                  document.querySelector('.block.reviewer button[title*="Edit"]');

        if (reviewerEditButton) {
            const teamButton = createTeamReviewButton();
            teamButton.classList.add('team-review-button');

            const selectorButton = createTeamSelectorButton();
            selectorButton.classList.add('team-selector-button');

            // Insert after edit button - Order: Team -> Selector -> Clear
            reviewerEditButton.parentNode.insertBefore(teamButton, reviewerEditButton.nextSibling);
            reviewerEditButton.parentNode.insertBefore(selectorButton, teamButton.nextSibling);

            // Only add clear button if there are reviewers - place it at the end
            const hasReviewers = await hasExistingReviewers();
            if (hasReviewers) {
                const clearButton = createClearReviewersButton();
                clearButton.classList.add('clear-reviewers-button');
                reviewerEditButton.parentNode.insertBefore(clearButton, selectorButton.nextSibling);
            }

            logInfo('GitLab Team Assigner: ✅ Team, selector and menu buttons injected');
        } else {
            logInfo('GitLab Team Assigner: ⚠️ Reviewer edit button not found');

            // If edit button is not found, try to add button anywhere in the reviewer section
            const reviewerSection = document.querySelector('.reviewers') ||
                                  document.querySelector('.reviewer') ||
                                  document.querySelector('.right-sidebar .block');

            if (reviewerSection) {
                logInfo('GitLab Team Assigner: 🔧 Adding buttons in reviewer section as a fallback');
                const teamButton = createTeamReviewButton();
                teamButton.classList.add('team-review-button');

                const selectorButton = createTeamSelectorButton();
                selectorButton.classList.add('team-selector-button');

                reviewerSection.appendChild(teamButton);
                reviewerSection.appendChild(selectorButton);

                // Only add clear button if there are reviewers - place it at the end
                const hasReviewers = await hasExistingReviewers();
                if (hasReviewers) {
                    const clearButton = createClearReviewersButton();
                    clearButton.classList.add('clear-reviewers-button');
                    clearButton.style.display = 'inline-block';
                    clearButton.style.width = 'fit-content';
                    reviewerSection.appendChild(clearButton);
                }
                logInfo('GitLab Team Assigner: ✅ Team, selector and menu buttons injected into reviewer section');
            } else {
                logInfo('GitLab Team Assigner: ❌ Reviewer section also not found');

                // Last resort: add anywhere in the right sidebar
                const sidebar = document.querySelector('.right-sidebar') ||
                               document.querySelector('.issuable-sidebar') ||
                               document.querySelector('[class*="sidebar"]');

                if (sidebar) {
                    logInfo('GitLab Team Assigner: 🔧 Adding buttons in sidebar as a last resort');
                    const teamButton = createTeamReviewButton();
                    teamButton.classList.add('team-review-button');

                    const selectorButton = createTeamSelectorButton();
                    selectorButton.classList.add('team-selector-button');

                    // Create a container
                    const container = document.createElement('div');
                    container.style.padding = '8px';
                    container.style.borderTop = '1px solid #ddd';
                    container.appendChild(teamButton);
                    container.appendChild(selectorButton);

                    // Only add clear button if there are reviewers - place it at the end
                    const hasReviewers = await hasExistingReviewers();
                    if (hasReviewers) {
                        const clearButton = createClearReviewersButton();
                        clearButton.classList.add('clear-reviewers-button');
                        clearButton.style.display = 'inline-block';
                        clearButton.style.width = 'fit-content';
                        container.appendChild(clearButton);
                    }

                    sidebar.appendChild(container);

                    logInfo('GitLab Team Assigner: ✅ Team, selector and menu buttons injected into sidebar');
                } else {
                    logInfo('GitLab Team Assigner: 🔧 Creating floating buttons as a final fallback');
                    const teamButton = createTeamReviewButton();
                    teamButton.classList.add('team-review-button');

                    const selectorButton = createTeamSelectorButton();
                    selectorButton.classList.add('team-selector-button');

                    document.body.appendChild(teamButton);
                    document.body.appendChild(selectorButton);

                    // Only add clear button if there are reviewers - place it at the end
                    const hasReviewers = await hasExistingReviewers();
                    if (hasReviewers) {
                        const clearButton = createClearReviewersButton();
                        clearButton.classList.add('clear-reviewers-button');
                        clearButton.style.position = 'fixed';
                        clearButton.style.top = '100px';
                        clearButton.style.right = '380px'; // Adjust position to ensure it's last
                        clearButton.style.zIndex = '9999';
                        clearButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
                                            document.body.appendChild(clearButton);
                }

                logInfo('GitLab Team Assigner: ✅ Floating team, selector and menu buttons created');
                }
            }
        }
    }

    // Initialize the script
    function initTeamAssigner() {
        logInfo('GitLab Team Assigner: 🔄 Initializing script...');

        // Check if on MR page
        if (!location.pathname.includes('/-/merge_requests/')) {
            logInfo('GitLab Team Assigner: ℹ️ Not on an MR page, skipping initialization');
            return;
        }

        // Skip if on edit page
        if (location.pathname.includes('/edit')) {
            logInfo('GitLab Team Assigner: ℹ️ On MR edit page, skipping button injection');
            return;
        }

        logInfo('GitLab Team Assigner: ✅ On an MR page, starting to inject buttons');

        // Wait for page elements to load before injecting buttons
        const maxAttempts = 10;
        let attempts = 0;

        const tryInject = () => {
            attempts++;
            logInfo(`GitLab Team Assigner: Attempting to inject buttons (${attempts}/${maxAttempts})`);

            injectTeamReviewButton();

            // If buttons were not successfully injected and max attempts not reached, try again
            if (!document.querySelector('.team-review-button') && attempts < maxAttempts) {
                setTimeout(tryInject, 1000);
            } else if (document.querySelector('.team-review-button')) {
                logInfo('GitLab Team Assigner: ✅ Buttons injected successfully');
            } else {
                logInfo('GitLab Team Assigner: ❌ Button injection failed, max attempts reached');
            }
        };

        tryInject();
    }

    // Wait for page to load
    function waitForPageLoad() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initTeamAssigner);
        } else {
            initTeamAssigner();
        }
    }

    // Watch for page changes (SPA navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            logInfo('GitLab Team Assigner: 🔄 Page change detected, re-initializing');
            setTimeout(initTeamAssigner, 1000); // Delay execution to ensure new page is loaded
        }
    }).observe(document, { subtree: true, childList: true });

    // Start the script
    waitForPageLoad();

    logInfo('GitLab Team Assigner: 🚀 Script loaded');

    // Create clear button
    function createClearReviewersButton() {
        const button = document.createElement('button');
        button.textContent = 'Clear All';
        button.className = 'btn btn-default btn-sm gl-button clear-reviewers-button';
        button.style.cssText = `
            margin-left: 4px;
            padding: 6px 12px;
            font-size: 12px;
        `;

        button.addEventListener('click', async () => {
            if (confirm('Are you sure you want to clear all reviewers?')) {
                try {
                    const apiInfo = getGitLabApiInfo();
                    const response = await fetch(
                        `${apiInfo.baseUrl}/${apiInfo.namespace}/${apiInfo.project}/-/merge_requests/${apiInfo.mrId}.json?serializer=sidebar_extras`,
                        {
                            method: 'PUT',
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': apiInfo.csrfToken,
                                'X-Requested-With': 'XMLHttpRequest'
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({
                                merge_request: {
                                    reviewer_ids: [],
                                    suggested_reviewer_ids: []
                                }
                            })
                        }
                    );

                    if (!response.ok) {
                        throw new Error(`Clear failed: ${response.status}`);
                    }

                    logInfo('GitLab Team Assigner: ✅ Cleared all reviewers');
                    
                    // Update clear button state
                    await updateClearButtonVisibility();
                } catch (error) {
                    logError('GitLab Team Assigner: ❌ Failed to clear reviewers:', error);
                    alert(`Failed to clear reviewers: ${error.message}`);
                }
            }
        });

        return button;
    }

    // Get current project path
    function getCurrentProjectPath() {
        const pathMatch = location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
        if (!pathMatch) return '';
        return `${pathMatch[1]}/${pathMatch[2]}`;
    }

    // Save forced team
    function saveProjectForcedTeam(teamName) {
        const projectPath = getCurrentProjectPath();
        if (!projectPath) return;

        const forcedTeams = JSON.parse(GM_getValue('forcedTeams', '{}'));
        forcedTeams[projectPath] = teamName;
        GM_setValue('forcedTeams', JSON.stringify(forcedTeams));
        logInfo(`GitLab Team Assigner: Forced team ${teamName} for project ${projectPath}`);
    }

    // Get project forced team
    function getProjectForcedTeam() {
        const projectPath = getCurrentProjectPath();
        if (!projectPath) return null;

        const forcedTeams = JSON.parse(GM_getValue('forcedTeams', '{}'));
        return forcedTeams[projectPath] || null;
    }

    // Clear project forced team
    function clearProjectForcedTeam() {
        const projectPath = getCurrentProjectPath();
        if (!projectPath) return;

        const forcedTeams = JSON.parse(GM_getValue('forcedTeams', '{}'));
        delete forcedTeams[projectPath];
        GM_setValue('forcedTeams', JSON.stringify(forcedTeams));
        logInfo(`GitLab Team Assigner: Cleared forced team setting for project ${projectPath}`);
    }

    // Check if current MR has reviewers
    async function hasExistingReviewers() {
        try {
            const apiInfo = getGitLabApiInfo();
            const response = await fetch(
                `${apiInfo.baseUrl}/${apiInfo.namespace}/${apiInfo.project}/-/merge_requests/${apiInfo.mrId}.json?serializer=sidebar_extras`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'X-CSRF-Token': apiInfo.csrfToken,
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to get reviewers: ${response.status}`);
            }

            const data = await response.json();
            return data.reviewers && data.reviewers.length > 0;
        } catch (error) {
            logError('GitLab Team Assigner: ❌ Failed to check for reviewers:', error);
            return false;
        }
    }

})();