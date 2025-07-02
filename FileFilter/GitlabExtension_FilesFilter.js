// ==UserScript==
// @name         GitLab Extension Files Filter
// @namespace    https://www.ringcentral.com
// @version      1.0.0
// @description  Add configurable file filters with multiple rules on GitLab MR diff page
// @author       Daniel Yang
// @match        https://git.ringcentral.com/*/-/merge_requests/*
// @run-at       document-start
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @grant        GM_info
// @updateURL    https://git.ringcentral.com/daniel.yang/gitlabextension_teamassign/-/raw/main/FileFilter/GitlabExtension_FilesFilter.js
// @downloadURL  https://git.ringcentral.com/daniel.yang/gitlabextension_teamassign/-/raw/main/FileFilter/GitlabExtension_FilesFilter.js
// ==/UserScript==

(function () {
    'use strict';
    
    // 记录脚本执行时机
    console.log('[GitLab Files Filter] Script execution started at:', new Date().toISOString());
    console.log('[GitLab Files Filter] Document readyState:', document.readyState);
    console.log('[GitLab Files Filter] Current URL:', unsafeWindow.location.href);
    
    // CRITICAL: Clear any cached startup calls to ensure fresh interception
    // 清理任何缓存的 startup calls，确保新鲜拦截
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.gl && unsafeWindow.gl.startup_calls) {
        console.log('[GitLab Files Filter] Clearing cached startup calls...');
        try {
            const startup_calls = Object.keys(unsafeWindow.gl.startup_calls);
            const diffKeys = startup_calls.filter((item) => {
                return _isDiffJsonRequest(item);
            });
            
            if (diffKeys.length > 0) {
                console.log(`[GitLab Files Filter] Found ${diffKeys.length} cached diff requests, clearing them...`);
                diffKeys.forEach(key => {
                    if (unsafeWindow.gl.startup_calls[key]) {
                        // 清除缓存的请求，强制重新发起
                        delete unsafeWindow.gl.startup_calls[key];
                        console.log(`[GitLab Files Filter] Cleared cached request: ${key}`);
                    }
                });
            }
        } catch (e) {
            console.log('[GitLab Files Filter] Error clearing cached startup calls:', e);
        }
    }
    
    // CRITICAL: Set up network interception IMMEDIATELY before any other code
    console.log('[GitLab Files Filter] Setting up network interception immediately...');
    
    // 存储原始函数引用
    const _originalFetch = unsafeWindow.fetch;
    const _originalXMLOpen = XMLHttpRequest.prototype.open;
    
    // 简单的URL检查函数
    const _isDiffJsonRequest = (url) => {
        if (!url) return false;
        const patterns = ['diffs_batch.json', 'diffs_metadata.json'];
        return patterns.some(pattern => url.includes(pattern));
    };
    
    // 简化的数据处理函数 - 直接进行过滤，不存储
    const _processResponse = async (response) => {
        if (!_isDiffJsonRequest(response.url)) {
            return response;
        }
        
        console.log('[GitLab Files Filter] Processing diff response from:', response.url);
        
        try {
            const responseClone = response.clone();
            const jsonData = await responseClone.json();
            
            // 判断API类型并记录
            if (response.url.includes('diffs_metadata.json')) {
                console.log(`[GitLab Files Filter] Processing diffs_metadata.json - full file list (${jsonData.diff_files?.length || 0} files)`);
                
                // metadata API - 只用于统计和UI更新，不修改Response
                _processMetadataResponse(jsonData, response.url);
                
                return response; // 返回原始Response
            } else {
                // diffs_batch.json - 需要修改Response来过滤文件
                console.log(`[GitLab Files Filter] Processing diffs_batch.json - ${jsonData.diff_files?.length || 0} files`);
                
                const [filteredData, hasChanges] = _filterJsonData(jsonData, response.url);
                
                if (hasChanges) {
                    console.log('[GitLab Files Filter] Returning filtered response');
                    return new Response(filteredData, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: response.headers
                    });
                }
            }
        } catch (e) {
            console.log('[GitLab Files Filter] Error processing response:', e);
        }
        
        return response;
    };
    
    // 处理metadata响应的函数
    const _processMetadataResponse = (jsonData, url) => {
        // 重置文件收集器，因为这是完整的文件列表
        if (typeof FileCollector !== 'undefined') {
            FileCollector.reset();
            
            // 处理所有文件用于计数
            jsonData.diff_files.forEach(file => {
                const filePath = file.new_path || file.old_path || '';
                if (filePath) {
                    FileCollector.addFile(filePath);
                    
                    // 检查每个规则是否匹配
                    if (typeof Storage !== 'undefined') {
                        const rules = Storage.getRules();
                        rules.forEach(rule => {
                            if (_matchesRule(filePath, rule)) {
                                FileCollector.addRuleFile(rule.id, filePath);
                            }
                        });
                    }
                }
            });
            
            // 计算所有规则的匹配文件数
            if (typeof Storage !== 'undefined' && typeof MemoryStorage !== 'undefined') {
                const rules = Storage.getRules();
                rules.forEach(rule => {
                    const count = FileCollector.getRuleFilesCount(rule.id);
                    if (count > 0) {
                        MemoryStorage.addFilterCount(rule.id, count);
                        console.log(`[GitLab Files Filter] Rule ${rule.name} matched ${count} files`);
                    }
                });
                
                // 设置总文件数
                MemoryStorage.setTotalFiles(jsonData.diff_files.length);
                
                // 立即更新UI
                console.log('[GitLab Files Filter] Metadata API processed, updating UI immediately');
                if (typeof FilterControls !== 'undefined') {
                    setTimeout(() => {
                        FilterControls.refreshAllTexts();
                        FilterControls.refresh();
                    }, 100);
                }
            }
        }
    };
    
    // 简化的过滤函数
    const _filterJsonData = (jsonData, url) => {
        if (!jsonData.diff_files || !Array.isArray(jsonData.diff_files)) {
            console.log('[GitLab Files Filter] No diff_files array found in JSON data');
            return [null, false];
        }
        
        // 如果Storage模块还没加载，暂时不进行过滤
        if (typeof Storage === 'undefined') {
            console.log('[GitLab Files Filter] Storage module not loaded yet, skipping filter');
            return [null, false];
        }
        
        const rules = Storage.getRules();
        const originalCount = jsonData.diff_files.length;
        console.log(`[GitLab Files Filter] Processing ${originalCount} files from ${url}`);
        
        // 详细记录所有文件路径
        jsonData.diff_files.forEach((file, index) => {
            const filePath = file.new_path || file.old_path || '';
            console.log(`[GitLab Files Filter] File ${index + 1}: ${filePath}`);
        });
        
        const filterStates = Storage.getFilterStates();
        const enabledRules = rules.filter(rule => filterStates[rule.id]);
        
        console.log(`[GitLab Files Filter] Total rules: ${rules.length}, Enabled rules: ${enabledRules.length}`);
        enabledRules.forEach(rule => {
            console.log(`[GitLab Files Filter] Enabled rule: ${rule.name} (${rule.id}) - pattern: ${rule.pattern}`);
        });
        
        if (enabledRules.length === 0) {
            console.log('[GitLab Files Filter] No enabled rules, skipping filter');
            return [null, false];
        }
        
        // 获取当前项目的模式
        const currentProject = _getCurrentProject();
        let projectMode = 'exclude'; // 默认模式
        
        if (currentProject && typeof Storage !== 'undefined') {
            const projects = Storage.getAllProjects();
            for (const projectRule of projects) {
                try {
                    const regex = new RegExp(projectRule.projectName);
                    if (regex.test(currentProject)) {
                        projectMode = projectRule.mode || 'exclude';
                        console.log(`[GitLab Files Filter] Using project mode: ${projectMode} for ${currentProject}`);
                        break;
                    }
                } catch (e) {
                    // 忽略无效的正则表达式
                }
            }
        }
        
        console.log(`[GitLab Files Filter] Project mode: ${projectMode}, Enabled rules: ${enabledRules.length}`);
        
        const filteredFiles = jsonData.diff_files.filter(file => {
            const filePath = file.new_path || file.old_path || '';
            console.log(`[GitLab Files Filter] Checking file: ${filePath}`);
            
            if (projectMode === 'include') {
                // Include模式：文件必须匹配至少一个启用的规则才能显示
                const matchesAnyRule = enabledRules.some(rule => {
                    const matches = _matchesRule(filePath, rule);
                    console.log(`[GitLab Files Filter] Include mode - Rule ${rule.name}: ${matches ? 'MATCHES' : 'no match'}`);
                    return matches;
                });
                console.log(`[GitLab Files Filter] Include mode - File ${filePath}: ${matchesAnyRule ? 'KEEP' : 'FILTER OUT'}`);
                return matchesAnyRule;
            } else {
                // Exclude模式：文件匹配任何启用的规则都会被排除
                for (const rule of enabledRules) {
                    const matches = _matchesRule(filePath, rule);
                    console.log(`[GitLab Files Filter] Exclude mode - Rule ${rule.name}: ${matches ? 'MATCHES' : 'no match'}`);
                    if (matches) {
                        console.log(`[GitLab Files Filter] Exclude mode - File ${filePath}: FILTER OUT (matched rule: ${rule.name})`);
                        return false;
                    }
                }
                console.log(`[GitLab Files Filter] Exclude mode - File ${filePath}: KEEP (no rules matched)`);
                return true;
            }
        });
        
        const hasChanges = filteredFiles.length !== originalCount;
        
        if (hasChanges) {
            console.log(`[GitLab Files Filter] Filtered ${originalCount} files to ${filteredFiles.length} files`);
            console.log(`[GitLab Files Filter] Remaining files:`, filteredFiles.map(f => f.new_path || f.old_path));
            return [JSON.stringify({ ...jsonData, diff_files: filteredFiles }), true];
        } else {
            console.log(`[GitLab Files Filter] No files filtered, returning original response`);
        }
        
        return [null, false];
    };
    
    // 简化的规则匹配函数
    const _matchesRule = (filePath, rule) => {
        try {
            const regex = new RegExp(rule.pattern);
            return regex.test(filePath);
        } catch (e) {
            console.log(`[GitLab Files Filter] Invalid regex pattern for rule ${rule.name}: ${rule.pattern}`, e);
            return false;
        }
    };
    
    // 简化的项目获取函数
    const _getCurrentProject = () => {
        const pathParts = unsafeWindow.location.pathname.split('/');
        if (pathParts.length >= 3) {
            return `${pathParts[1]}/${pathParts[2]}`;
        }
        return null;
    };
    
    // Intercept fetch immediately - 直接进行过滤
    unsafeWindow.fetch = function(url, options) {
        if (_isDiffJsonRequest(url)) {
            console.log('[GitLab Files Filter] Intercepting fetch request:', url);
            return _originalFetch.call(this, url, options).then(_processResponse);
        }
        return _originalFetch.call(this, url, options);
    };
    
    // Intercept XMLHttpRequest immediately - 使用addEventListener方式
    XMLHttpRequest.prototype.open = function(method, url) {
        this._url = url;
        if (_isDiffJsonRequest(url)) {
            console.log('[GitLab Files Filter] Intercepting XHR request:', url);
            
            // 使用addEventListener而不是替换onreadystatechange
            this.addEventListener('readystatechange', function() {
                if (this.readyState === 4 && this.status === 200) {
                    try {
                        console.log('[GitLab Files Filter] XHR response received for:', this._url);
                        const jsonData = JSON.parse(this.responseText);
                        
                        if (this._url.includes('diffs_metadata.json')) {
                            // metadata API - 只用于统计
                            _processMetadataResponse(jsonData, this._url);
                        } else {
                            // batch API - 进行过滤
                            const [filteredData, hasChanges] = _filterJsonData(jsonData, this._url);
                            
                            if (hasChanges) {
                                console.log('[GitLab Files Filter] Modifying XHR response');
                                Object.defineProperty(this, 'response', { 
                                    value: filteredData,
                                    writable: false,
                                    configurable: false
                                });
                                Object.defineProperty(this, 'responseText', { 
                                    value: filteredData,
                                    writable: false,
                                    configurable: false
                                });
                            }
                        }
                    } catch (e) {
                        console.log('[GitLab Files Filter] Error processing XHR response:', e);
                    }
                }
            });
        }
        return _originalXMLOpen.apply(this, arguments);
    };
    
    // CRITICAL: Handle GitLab startup calls that may have been initiated before our interceptors
    // 处理 GitLab 在页面加载时就已经发起的请求
    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.gl && unsafeWindow.gl.startup_calls) {
        console.log('[GitLab Files Filter] Processing GitLab startup calls...');
        try {
            const startup_calls = Object.keys(unsafeWindow.gl.startup_calls);
            const diffKeys = startup_calls.filter((item) => {
                return _isDiffJsonRequest(item);
            });
            
            console.log(`[GitLab Files Filter] Found ${diffKeys.length} diff requests in startup calls:`, diffKeys);
            
            if (diffKeys.length > 0) {
                for (const key of diffKeys) {
                    console.log(`[GitLab Files Filter] Replacing startup call for: ${key}`);
                    
                    // 直接拦截这个请求并立即处理
                    const originalFetchCall = unsafeWindow.gl.startup_calls[key].fetchCall;
                    unsafeWindow.gl.startup_calls[key].fetchCall = async function() {
                        console.log(`[GitLab Files Filter] Intercepting startup call: ${key}`);
                        try {
                            const response = await _originalFetch(key, {
                                headers: {
                                    'X-Requested-With': 'XMLHttpRequest'
                                },
                                credentials: 'same-origin'
                            });
                            
                            // 直接处理响应
                            return await _processResponse(response);
                        } catch (e) {
                            console.log(`[GitLab Files Filter] Error processing startup call ${key}:`, e);
                            // 如果出错，回退到原始调用
                            return originalFetchCall ? originalFetchCall.apply(this, arguments) : response;
                        }
                    };
                }
            }
        } catch (e) {
            console.log('[GitLab Files Filter] Error processing startup calls:', e);
        }
    } else {
        console.log('[GitLab Files Filter] No GitLab startup calls found or unsafeWindow not available');
    }
    
    // Constants
    const CONFIG = {
        VERSION: GM_info.script.version,
        RULES_KEY: 'gitlab-files-filter-rules',
        FILTER_STATES_KEY: 'gitlab-files-filter-states',
        PROJECTS_KEY: 'gitlab-files-filter-projects',
        FILTER_CLASS: 'gitlab-files-filter-container',
        CONFIG_MODAL_CLASS: 'gitlab-files-filter-modal',
        DIFF_JSON_PATTERNS: [
            'diffs_batch.json',
            'diffs_metadata.json'
        ],
        SELECTORS: {
            DIFF_PAGE: '/diffs',
            TOP_BAR: 'div.top-bar-container'
        },
        PROJECTS: [
            {
                projectName: 'Fiji/Fiji',
                mode: 'exclude',
                rules: [
                    { id: 'fiji-ut-files', name: 'UT Files', pattern: '\.test\.', enabled: false, description: 'Filter out Fiji unit test files (*.test.*)' },
                    { id: 'fiji-json-files', name: 'JSON Files', pattern: '\.json$', enabled: false, description: 'Filter out Fiji JSON files (*.json)' },
                    { id: 'fiji-ts-tsx-files', name: 'TS/TSX Files', pattern: '\.(ts|tsx)$', enabled: false, description: 'Filter out Fiji TS/TSX files (*.ts, *.tsx)' }
                ]
            },
            {
                projectName: 'CoreLib/mthor',
                mode: 'include',
                rules: [
                    { id: 'mthor-cpp-files', name: 'C++ Files', pattern: '(\.(cpp|cc|cxx|hpp|h|inl)$|src/cpp/|include/)', enabled: false, description: 'Show only C++ related files (*.cpp, *.cc, *.cxx, *.hpp, *.h, *.inl, cpp/ directories)' },
                    { id: 'mthor-iOS-files', name: 'iOS Files', pattern: '(\.m$|.mm$|.h$|.swift$)', enabled: false, description: 'Show only iOS related files (*.m, *.mm, *.h, *.swift)' },
                    { id: 'mthor-android-files', name: 'Android Files', pattern: '(\.java$|.kt$)', enabled: false, description: 'Show only Android related files (*.java, *.kt)' }
                ]
            },
            {
                projectName: 'Default',
                mode: 'exclude',
                rules: [
                    { id: 'all-test-files', name: 'All Test Files', pattern: '(\.(test|spec)\.|__tests__/|__test__/|/tests/|/test/)', enabled: false, description: 'Filter out all test files: .test., .spec., __tests__/ and /tests/ directories' }
                ]
            }
        ]
    };
    
    const THEME_COLORS = {
        DARK: {
            background: '#303030',
            backgroundHover: '#404040',
            border: '#525252',
            borderHover: '#6b6b6b',
            text: '#fafafa',
            modalBackground: '#2d2d2d',
            inputBackground: '#404040'
        },
        LIGHT: {
            background: '#ffffff',
            backgroundHover: '#f9f9f9',
            border: '#dbdbdb',
            borderHover: '#bfbfbf',
            text: '#303030',
            modalBackground: '#ffffff',
            inputBackground: '#ffffff'
        },
        ACCENT: '#1f75cb',
        SUCCESS: '#28a745',
        DANGER: '#dc3545',
        WARNING: '#ffc107'
    };
    
    // 全局文件收集器 - 提前定义以避免初始化顺序问题
    const FileCollector = {
        allFilesSet: new Set(),
        ruleFilesMap: {}, // { ruleId: Set }
        
        reset() {
            this.allFilesSet.clear();
            this.ruleFilesMap = {};
            console.log('[GitLab Files Filter] FileCollector reset - cleared all file data');
        },
        
        addFile(filePath) {
            if (filePath) {
                this.allFilesSet.add(filePath);
            }
        },
        
        addRuleFile(ruleId, filePath) {
            if (filePath && ruleId) {
                if (!this.ruleFilesMap[ruleId]) {
                    this.ruleFilesMap[ruleId] = new Set();
                }
                this.ruleFilesMap[ruleId].add(filePath);
            }
        },
        
        getAllFilesCount() {
            return this.allFilesSet.size;
        },
        
        getRuleFilesCount(ruleId) {
            return this.ruleFilesMap[ruleId] ? this.ruleFilesMap[ruleId].size : 0;
        },
        
        getRuleFiles(ruleId) {
            return this.ruleFilesMap[ruleId] ? Array.from(this.ruleFilesMap[ruleId]) : [];
        }
    };

    // 在页面加载时重置文件收集器
    FileCollector.reset();
    
    // Core utilities
    const Utils = {
        isDiffPage: () => unsafeWindow.location.href.includes(CONFIG.SELECTORS.DIFF_PAGE),
        isDiffJsonRequest: (url) => {
            if (!url) return false;
            return CONFIG.DIFF_JSON_PATTERNS.some(pattern => url.includes(pattern));
        },
        
        // 获取当前项目信息
        getCurrentProject: () => {
            const pathParts = unsafeWindow.location.pathname.split('/');
            if (pathParts.length >= 3) {
                return `${pathParts[1]}/${pathParts[2]}`;
            }
            return null;
        },
        
        // 查找匹配的项目规则
        findMatchingProjectRule: (currentProject) => {
            if (!currentProject) return null;
            
            const projects = Storage.getAllProjects();
            for (const projectRule of projects) {
                try {
                    const regex = new RegExp(projectRule.projectName);
                    if (regex.test(currentProject)) {
                        return projectRule;
                    }
                } catch (e) {
                    console.log(`[GitLab Files Filter] Invalid project pattern: ${projectRule.projectName}`, e);
                }
            }
            return null;
        },
        
        // 获取当前项目对应的规则
        getProjectRules: () => {
            const currentProject = Utils.getCurrentProject();
            if (!currentProject) {
                console.log('[GitLab Files Filter] No project detected, using default rules');
                const projects = Storage.getAllProjects();
                const defaultProject = projects.find(rule => rule.projectName === 'Default');
                return defaultProject.rules.map(rule => ({ ...rule, projectMode: defaultProject.mode }));
            }
            
            const matchedProjectRule = Utils.findMatchingProjectRule(currentProject);
            if (matchedProjectRule) {
                console.log(`[GitLab Files Filter] Using project-specific rules for: ${currentProject} (matched pattern: ${matchedProjectRule.projectName})`);
                return matchedProjectRule.rules.map(rule => ({ ...rule, projectMode: matchedProjectRule.mode }));
            }
            
            console.log(`[GitLab Files Filter] No specific rules found for project: ${currentProject}, using default rules`);
            const projects = Storage.getAllProjects();
            const defaultProject = projects.find(rule => rule.projectName === 'Default');
            return defaultProject.rules.map(rule => ({ ...rule, projectMode: defaultProject.mode }));
        },
        
        isDarkTheme: () => {
            return document.documentElement.classList.contains('gl-dark') || 
                   document.body.classList.contains('gl-dark') ||
                   document.documentElement.getAttribute('data-theme') === 'dark';
        },
        
        getThemeColors: () => {
            const theme = Utils.isDarkTheme() ? THEME_COLORS.DARK : THEME_COLORS.LIGHT;
            return { ...theme, accent: THEME_COLORS.ACCENT, success: THEME_COLORS.SUCCESS, danger: THEME_COLORS.DANGER, warning: THEME_COLORS.WARNING };
        },
        
        generateId: () => {
            return 'rule-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
    };
    
    // Memory storage, per MR isolation
    const MemoryStorage = {
        // Get current MR's unique identifier
        getMRId: () => {
            const pathParts = unsafeWindow.location.pathname.split('/');
            const mrIndex = pathParts.findIndex(part => part === 'merge_requests');
            if (mrIndex !== -1 && pathParts[mrIndex + 1]) {
                return `mr-${pathParts[mrIndex + 1]}`;
            }
            return 'unknown-mr';
        },
        
        // Memory-based data storage
        data: {
            filteredFiles: {},
            filterCounts: {},
            totalFiles: 0
        },
        
        // Initialize current MR's data
        initMRData: () => {
            const mrId = MemoryStorage.getMRId();
            if (!MemoryStorage.data.filteredFiles[mrId]) {
                MemoryStorage.data.filteredFiles[mrId] = {};
                MemoryStorage.data.filterCounts[mrId] = {};
                MemoryStorage.data.totalFiles = 0;
                console.log(`[GitLab Files Filter] Initialized data for MR: ${mrId}`);
            }
        },
        
        // Get current MR's file mapping
        getFilteredFiles: () => {
            MemoryStorage.initMRData();
            const mrId = MemoryStorage.getMRId();
            return MemoryStorage.data.filteredFiles[mrId] || {};
        },
        
        // Add file to current MR
        addFilteredFile: (ruleId, filePath) => {
            MemoryStorage.initMRData();
            const mrId = MemoryStorage.getMRId();
            
            if (!MemoryStorage.data.filteredFiles[mrId][ruleId]) {
                MemoryStorage.data.filteredFiles[mrId][ruleId] = [];
            }
            
            // Check if file already exists, avoid duplicate addition
            if (!MemoryStorage.data.filteredFiles[mrId][ruleId].includes(filePath)) {
                MemoryStorage.data.filteredFiles[mrId][ruleId].push(filePath);
                console.log(`[GitLab Files Filter] Added new file to rule ${ruleId} in MR ${mrId}: ${filePath}`);
            } else {
                console.log(`[GitLab Files Filter] File already exists in rule ${ruleId} in MR ${mrId}: ${filePath}`);
            }
        },
        
        // Check if file is already counted
        isFileFiltered: (ruleId, filePath) => {
            MemoryStorage.initMRData();
            const mrId = MemoryStorage.getMRId();
            const ruleFiles = MemoryStorage.data.filteredFiles[mrId][ruleId] || [];
            return ruleFiles.includes(filePath);
        },
        
        // Get current MR's counts
        getFilterCounts: () => {
            MemoryStorage.initMRData();
            const mrId = MemoryStorage.getMRId();
            return MemoryStorage.data.filterCounts[mrId] || {};
        },
        
        // Add count to current MR
        addFilterCount: (ruleId, count) => {
            MemoryStorage.initMRData();
            const mrId = MemoryStorage.getMRId();
            
            if (!MemoryStorage.data.filterCounts[mrId][ruleId]) {
                MemoryStorage.data.filterCounts[mrId][ruleId] = 0;
            }
            MemoryStorage.data.filterCounts[mrId][ruleId] += count;
            return MemoryStorage.data.filterCounts[mrId][ruleId];
        },
        
        // Set total file count
        setTotalFiles: (count) => {
            MemoryStorage.data.totalFiles = count;
        },
        
        // Get total file count
        getTotalFiles: () => {
            return MemoryStorage.data.totalFiles;
        },
        
        // Clear current MR's data
        clearCurrentMRData: () => {
            const mrId = MemoryStorage.getMRId();
            delete MemoryStorage.data.filteredFiles[mrId];
            delete MemoryStorage.data.filterCounts[mrId];
            MemoryStorage.data.totalFiles = 0;
            console.log(`[GitLab Files Filter] Cleared data for MR: ${mrId}`);
        },
        
        // Clear all data
        clearAllData: () => {
            const mrId = MemoryStorage.getMRId();
            delete MemoryStorage.data.filteredFiles[mrId];
            delete MemoryStorage.data.filterCounts[mrId];
            MemoryStorage.data.totalFiles = 0;
            console.log(`[GitLab Files Filter] Cleared data for MR: ${mrId}`);
        },
    };
    
    // Storage operations with version prefix
    const Storage = {
        getVersionedKey: (key) => `v${CONFIG.VERSION}_${key}`,
        
        safeGet: (key, defaultValue) => {
            try {
                const versionedKey = Storage.getVersionedKey(key);
                const saved = GM_getValue(versionedKey, null);
                
                if (saved === null) {
                    const oldData = GM_getValue(key, null);
                    if (oldData !== null) {
                        console.log(`[GitLab Files Filter] Migrating data from old key: ${key} to ${versionedKey}`);
                        GM_setValue(versionedKey, oldData);
                        return JSON.parse(oldData);
                    }
                    return defaultValue;
                }
                
                return JSON.parse(saved);
            } catch (e) {
                console.log(`[GitLab Files Filter] Error reading storage key ${key}:`, e);
                return defaultValue;
            }
        },
        
        safeSet: (key, value) => {
            try {
                const versionedKey = Storage.getVersionedKey(key);
                GM_setValue(versionedKey, JSON.stringify(value));
            } catch (e) {
                console.log(`[GitLab Files Filter] Error saving to storage key ${key}:`, e);
            }
        },
        
        getRules: () => {
            try {
                const savedRules = Storage.safeGet(CONFIG.RULES_KEY, null);
                if (savedRules && Array.isArray(savedRules)) {
                    console.log('[GitLab Files Filter] Using saved custom rules');
                    return savedRules;
                }
                const projectRules = Utils.getProjectRules();
                console.log(`[GitLab Files Filter] Using project rules: ${projectRules.length} rules`);
                return projectRules;
            } catch (e) {
                console.log('[GitLab Files Filter] Error getting rules from storage:', e);
                return Utils.getProjectRules();
            }
        },
        
        setRules: (rules) => Storage.safeSet(CONFIG.RULES_KEY, rules),
        
        getFilterStates: () => Storage.safeGet(CONFIG.FILTER_STATES_KEY, {}),
        
        setFilterState: (ruleId, enabled) => {
            const states = Storage.getFilterStates();
            states[ruleId] = enabled;
            Storage.safeSet(CONFIG.FILTER_STATES_KEY, states);
        },
        
        getFilterCounts: () => MemoryStorage.getFilterCounts(),
        
        addFilterCount: (ruleId, count) => MemoryStorage.addFilterCount(ruleId, count),
        
        resetFilterCounts: () => MemoryStorage.clearCurrentMRData(),
        
        getFilteredFiles: () => MemoryStorage.getFilteredFiles(),
        
        addFilteredFile: (ruleId, filePath) => MemoryStorage.addFilteredFile(ruleId, filePath),
        
        isFileFiltered: (ruleId, filePath) => MemoryStorage.isFileFiltered(ruleId, filePath),
        
        clearFilteredFiles: () => MemoryStorage.clearCurrentMRData(),
        
        addRule: (rule) => {
            const rules = Storage.getRules();
            rule.id = rule.id || Utils.generateId();
            rules.push(rule);
            Storage.setRules(rules);
            return rule;
        },
        
        updateRule: (ruleId, updatedRule) => {
            const rules = Storage.getRules();
            const index = rules.findIndex(r => r.id === ruleId);
            if (index !== -1) {
                rules[index] = { ...rules[index], ...updatedRule };
                Storage.setRules(rules);
                return rules[index];
            }
            return null;
        },
        
        deleteRule: (ruleId) => {
            const rules = Storage.getRules();
            const filteredRules = rules.filter(r => r.id !== ruleId);
            Storage.setRules(filteredRules);
            
            const states = Storage.getFilterStates();
            delete states[ruleId];
            Storage.safeSet(CONFIG.FILTER_STATES_KEY, states);
            
            console.log(`[GitLab Files Filter] Rule ${ruleId} deleted, file mapping will be cleared on page refresh`);
        },
        
        getStorageInfo: () => {
            const version = CONFIG.VERSION;
            const keys = [CONFIG.RULES_KEY, CONFIG.FILTER_STATES_KEY];
            const info = { version, keys: {} };
            
            keys.forEach(key => {
                const versionedKey = Storage.getVersionedKey(key);
                const hasVersionedData = GM_getValue(versionedKey, null) !== null;
                const hasOldData = GM_getValue(key, null) !== null;
                
                info.keys[key] = {
                    versionedKey,
                    hasVersionedData,
                    hasOldData,
                    needsMigration: !hasVersionedData && hasOldData
                };
            });
            
            return info;
        },
        
        clearAllData: () => {
            const keys = [CONFIG.RULES_KEY, CONFIG.FILTER_STATES_KEY, CONFIG.PROJECTS_KEY];
            keys.forEach(key => {
                const versionedKey = Storage.getVersionedKey(key);
                try {
                    GM_deleteValue(versionedKey);
                } catch (e) {
                    console.log(`[GitLab Files Filter] Error clearing versioned data ${versionedKey}:`, e);
                }
            });
            MemoryStorage.clearAllData();
        },
        
        getAllProjects: () => {
            try {
                const savedProjects = Storage.safeGet(CONFIG.PROJECTS_KEY, null);
                if (savedProjects && Array.isArray(savedProjects)) {
                    console.log('[GitLab Files Filter] Using saved custom projects');
                    return savedProjects;
                }
                // 如果没有保存的项目配置，使用默认配置
                const defaultProjects = CONFIG.PROJECTS.map(project => ({
                    projectName: project.projectName,
                    mode: project.mode,
                    rules: project.rules.map(rule => ({ ...rule }))
                }));
                console.log(`[GitLab Files Filter] Using default projects: ${defaultProjects.length} projects`);
                return defaultProjects;
            } catch (e) {
                console.log('[GitLab Files Filter] Error getting projects from storage:', e);
                return CONFIG.PROJECTS.map(project => ({
                    projectName: project.projectName,
                    mode: project.mode,
                    rules: project.rules.map(rule => ({ ...rule }))
                }));
            }
        },
        
        setAllProjects: (projects) => {
            Storage.safeSet(CONFIG.PROJECTS_KEY, projects);
            console.log(`[GitLab Files Filter] Saved ${projects.length} projects to storage`);
        },
        
        addProject: (project) => {
            const projects = Storage.getAllProjects();
            // 检查项目名是否已存在
            if (projects.find(p => p.projectName === project.projectName)) {
                throw new Error(`Project "${project.projectName}" already exists`);
            }
            // 为每个规则生成唯一ID
            project.rules = project.rules.map(rule => ({
                ...rule,
                id: rule.id || Utils.generateId()
            }));
            projects.push(project);
            Storage.setAllProjects(projects);
            console.log(`[GitLab Files Filter] Added new project: ${project.projectName}`);
            return project;
        },
        
        updateProject: (projectName, updatedProject) => {
            const projects = Storage.getAllProjects();
            const index = projects.findIndex(p => p.projectName === projectName);
            if (index === -1) {
                throw new Error(`Project "${projectName}" not found`);
            }
            
            // 如果项目名被修改，检查新名称是否已存在
            if (updatedProject.projectName !== projectName) {
                if (projects.find(p => p.projectName === updatedProject.projectName)) {
                    throw new Error(`Project "${updatedProject.projectName}" already exists`);
                }
            }
            
            // 为每个规则生成唯一ID（如果没有的话）
            updatedProject.rules = updatedProject.rules.map(rule => ({
                ...rule,
                id: rule.id || Utils.generateId()
            }));
            
            projects[index] = updatedProject;
            Storage.setAllProjects(projects);
            console.log(`[GitLab Files Filter] Updated project: ${projectName} -> ${updatedProject.projectName}`);
            return updatedProject;
        },
    };
    
    // Configuration Modal
    const ConfigModal = {
        createButton: (text, color, onClick, extraStyle = '') => {
            const colors = Utils.getThemeColors();
            const btn = document.createElement('button');
            btn.textContent = text;
            btn.style.cssText = `
                background: ${colors[color]}; color: white; border: none;
                padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 12px;
                ${extraStyle}
            `;
            btn.onclick = onClick;
            return btn;
        },
        
        create: () => {
            const colors = Utils.getThemeColors();
            
            const overlay = document.createElement('div');
            overlay.className = CONFIG.CONFIG_MODAL_CLASS;
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.5); z-index: 10000; display: flex;
                align-items: center; justify-content: center;
            `;
            
            const modal = document.createElement('div');
            modal.style.cssText = `
                background: ${colors.modalBackground}; border-radius: 8px;
                padding: 1.5rem; min-width: 700px; max-width: 95vw;
                max-height: 85vh; overflow-y: auto; color: ${colors.text};
                border: 1px solid ${colors.border};
            `;
            
            // Header
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
            
            const title = document.createElement('h3');
            title.textContent = 'Project File Filter Configurations';
            title.style.cssText = 'margin: 0; color: ' + colors.text;
            
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '×';
            closeBtn.style.cssText = `
                background: none; border: none; font-size: 24px; cursor: pointer;
                color: ${colors.text}; padding: 0; width: 30px; height: 30px;
                display: flex; align-items: center; justify-content: center;
            `;
            closeBtn.onclick = () => ConfigModal.close();
            
            header.appendChild(title);
            header.appendChild(closeBtn);
            
            // 卡片区
            const cardList = document.createElement('div');
            cardList.style.cssText = 'display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 2rem;';
            
            // 获取所有项目配置
            const projects = Storage.getAllProjects();
            projects.forEach(project => {
                const card = document.createElement('div');
                card.style.cssText = `
                    background: ${colors.background}; border: 1px solid ${colors.border}; border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04); padding: 1.2rem 1.5rem; min-width: 320px; max-width: 350px;
                    display: flex; flex-direction: column; gap: 0.5rem; position: relative;
                `;
                
                // 项目名
                const name = document.createElement('div');
                name.textContent = project.projectName;
                name.style.cssText = 'font-size: 1.1rem; font-weight: bold; color: ' + colors.accent + '; margin-bottom: 0.2rem;';
                card.appendChild(name);
                
                // mode
                const mode = document.createElement('div');
                mode.innerHTML = `<strong>Mode:</strong> <span style="color:${project.mode==='include'?colors.success:colors.danger};font-weight:bold;">${project.mode==='include'?'✅ Include':'🚫 Exclude'}</span>`;
                card.appendChild(mode);
                
                // 规则数量
                const ruleCount = document.createElement('div');
                ruleCount.innerHTML = `<strong>Rules:</strong> ${project.rules.length}`;
                card.appendChild(ruleCount);
                
                // 规则预览
                const rulePreview = document.createElement('ul');
                rulePreview.style.cssText = 'margin: 0.5rem 0 0 0; padding-left: 1.2rem; font-size: 13px; color: '+colors.text+';';
                project.rules.slice(0, 3).forEach(rule => {
                    const li = document.createElement('li');
                    li.textContent = rule.name + '  [' + rule.pattern + ']';
                    rulePreview.appendChild(li);
                });
                if (project.rules.length > 3) {
                    const more = document.createElement('li');
                    more.textContent = `...and ${project.rules.length-3} more`;
                    rulePreview.appendChild(more);
                }
                card.appendChild(rulePreview);
                
                // 操作按钮
                const btnRow = document.createElement('div');
                btnRow.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.8rem;';
                const editBtn = ConfigModal.createButton('Edit', 'accent', () => ConfigModal.showProjectDetail(project.projectName));
                btnRow.appendChild(editBtn);
                if (project.projectName !== 'Default') {
                    const delBtn = ConfigModal.createButton('Delete', 'danger', () => ConfigModal.deleteProject(project.projectName));
                    btnRow.appendChild(delBtn);
                }
                card.appendChild(btnRow);
                
                cardList.appendChild(card);
            });
            
            // 新增Project按钮
            const addProjectBtn = ConfigModal.createButton('+ Add Project', 'success', () => ConfigModal.showProjectDetail(null), 'padding: 0.7rem 1.5rem; font-size: 16px; margin-top: 1rem;');
            
            // Footer
            const footer = document.createElement('div');
            footer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 1.5rem;';
            const closeBtn2 = ConfigModal.createButton('Close', 'accent', () => ConfigModal.close(), 'padding: 0.7rem 1.5rem; font-size: 16px;');
            footer.appendChild(closeBtn2);
            
            modal.appendChild(header);
            modal.appendChild(cardList);
            modal.appendChild(addProjectBtn);
            modal.appendChild(footer);
            overlay.appendChild(modal);
            
            overlay.onclick = (e) => {
                if (e.target === overlay) ConfigModal.close();
            };
            
            return overlay;
        },
        
        showProjectDetail: (projectName) => {
            const colors = Utils.getThemeColors();
            const isEdit = !!projectName;
            const projects = Storage.getAllProjects();
            const project = isEdit ? projects.find(p => p.projectName === projectName) : null;
            
            const formDiv = document.createElement('div');
            formDiv.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.7); z-index: 10001; display: flex;
                align-items: center; justify-content: center;
            `;
            
            const form = document.createElement('div');
            form.style.cssText = `
                background: ${colors.modalBackground}; border-radius: 8px;
                padding: 1.5rem; min-width: 600px; max-width: 90vw; max-height: 85vh;
                color: ${colors.text}; border: 1px solid ${colors.border}; overflow-y: auto;
            `;
            
            form.innerHTML = `
                <h3 style="margin: 0 0 1.5rem 0; color: ${colors.text};">
                    ${isEdit ? 'Edit Project' : 'Add New Project'}
                </h3>
                
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: ${colors.text}; font-weight: bold;">Project Name:</label>
                    <input type="text" id="project-name" value="${project?.projectName || ''}" 
                           style="width: 100%; padding: 0.5rem; border: 1px solid ${colors.border}; 
                                  border-radius: 4px; background: ${colors.inputBackground}; color: ${colors.text};" 
                           placeholder="e.g., MyProject/SubProject">
                    <div style="font-size: 12px; color: ${colors.text}; opacity: 0.7; margin-top: 0.25rem;">
                        Use exact project name or regex pattern to match projects
                            </div>
                        </div>
                        
                <div style="margin-bottom: 1.5rem;">
                    <label style="display: block; margin-bottom: 0.5rem; color: ${colors.text}; font-weight: bold;">Filter Mode:</label>
                    <div style="display: flex; gap: 1rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="project-mode" value="exclude" 
                                   ${(!project || project.mode === 'exclude') ? 'checked' : ''}>
                            <span style="color: ${colors.danger}; font-weight: bold;">🚫 Exclude</span>
                            <span style="font-size: 12px; opacity: 0.7;">Hide files matching rules</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                            <input type="radio" name="project-mode" value="include" 
                                   ${(project && project.mode === 'include') ? 'checked' : ''}>
                            <span style="color: ${colors.success}; font-weight: bold;">✅ Include</span>
                            <span style="font-size: 12px; opacity: 0.7;">Show only files matching rules</span>
                        </label>
                            </div>
                        </div>
                        
                <div style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <label style="color: ${colors.text}; font-weight: bold;">Rules:</label>
                        <button id="add-rule-btn" style="background: ${colors.success}; color: white; border: none; 
                                                           padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 12px;">
                            + Add Rule
                        </button>
                            </div>
                    <div id="rules-container" style="border: 1px solid ${colors.border}; border-radius: 4px; 
                                                    padding: 0.5rem; background: ${colors.background}; max-height: 300px; overflow-y: auto;">
                        ${project ? project.rules.map((rule, index) => `
                            <div class="rule-item" style="border: 1px solid ${colors.border}; border-radius: 4px; 
                                                          padding: 0.5rem; margin-bottom: 0.5rem; background: ${colors.modalBackground};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                                    <input type="text" class="rule-name" value="${rule.name}" placeholder="Rule name"
                                           style="flex: 1; margin-right: 0.5rem; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                                  border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text};">
                                    <button class="delete-rule-btn" data-index="${index}" style="background: ${colors.danger}; color: white; border: none; 
                                                                                           padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 12px;">
                                        Delete
                                    </button>
                        </div>
                                <input type="text" class="rule-pattern" value="${rule.pattern}" placeholder="RegExp pattern"
                                       style="width: 100%; margin-bottom: 0.5rem; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                              border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text};">
                                <textarea class="rule-description" placeholder="Description (optional)" rows="2"
                                          style="width: 100%; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                                 border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text}; resize: vertical;">${rule.description || ''}</textarea>
                            </div>
                        `).join('') : ''}
                        </div>
                    </div>
                    
                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
                    <button id="cancel-btn" style="background: ${colors.border}; color: ${colors.text}; border: none; 
                                                   padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="save-btn" style="background: ${colors.success}; color: white; border: none; 
                                                 padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer;">
                        ${isEdit ? 'Update' : 'Add'} Project
                    </button>
                </div>
            `;
            
            // 添加规则按钮事件
            form.querySelector('#add-rule-btn').onclick = () => {
                const rulesContainer = form.querySelector('#rules-container');
                const ruleIndex = rulesContainer.children.length;
                const ruleDiv = document.createElement('div');
                ruleDiv.className = 'rule-item';
                ruleDiv.style.cssText = `border: 1px solid ${colors.border}; border-radius: 4px; 
                                        padding: 0.5rem; margin-bottom: 0.5rem; background: ${colors.modalBackground};`;
                ruleDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <input type="text" class="rule-name" placeholder="Rule name"
                               style="flex: 1; margin-right: 0.5rem; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                      border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text};">
                        <button class="delete-rule-btn" data-index="${ruleIndex}" style="background: ${colors.danger}; color: white; border: none; 
                                                                       padding: 0.25rem 0.5rem; border-radius: 3px; cursor: pointer; font-size: 12px;">
                            Delete
                        </button>
                    </div>
                    <input type="text" class="rule-pattern" placeholder="RegExp pattern"
                           style="width: 100%; margin-bottom: 0.5rem; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                  border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text};">
                    <textarea class="rule-description" placeholder="Description (optional)" rows="2"
                              style="width: 100%; padding: 0.25rem; border: 1px solid ${colors.border}; 
                                     border-radius: 3px; background: ${colors.inputBackground}; color: ${colors.text}; resize: vertical;"></textarea>
                `;
                rulesContainer.appendChild(ruleDiv);
            };
            
            // 删除规则按钮事件
            form.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-rule-btn')) {
                    e.target.closest('.rule-item').remove();
                }
            });
            
            // 取消按钮事件
            form.querySelector('#cancel-btn').onclick = () => {
                document.body.removeChild(formDiv);
            };
            
            // 保存按钮事件
            form.querySelector('#save-btn').onclick = () => {
                const projectName = form.querySelector('#project-name').value.trim();
                const mode = form.querySelector('input[name="project-mode"]:checked').value;
                
                if (!projectName) {
                    alert('Please enter a project name.');
                    return;
                }
                
                // 收集规则
                const rules = [];
                form.querySelectorAll('.rule-item').forEach((ruleItem, index) => {
                    const name = ruleItem.querySelector('.rule-name').value.trim();
                    const pattern = ruleItem.querySelector('.rule-pattern').value.trim();
                    const description = ruleItem.querySelector('.rule-description').value.trim();
                    
                    if (name && pattern) {
                        // 验证正则表达式
                try {
                    new RegExp(pattern);
                            rules.push({
                                id: project?.rules[index]?.id || Utils.generateId(),
                                name,
                                pattern,
                                description,
                                enabled: false
                            });
                } catch (e) {
                            alert(`Invalid regular expression in rule "${name}": ${pattern}`);
                    return;
                }
                    }
                });
                
                if (rules.length === 0) {
                    alert('Please add at least one rule.');
                    return;
                }
                
                const projectData = {
                    projectName,
                    mode,
                    rules
                };
                
                try {
                    if (isEdit) {
                        Storage.updateProject(projectName, projectData);
                } else {
                        Storage.addProject(projectData);
                    }
                    
                    document.body.removeChild(formDiv);
                    ConfigModal.close();
                    
                    // 提示用户并询问是否刷新页面
                    if (confirm('Project configuration saved successfully! Would you like to refresh the page to see the new configuration in action?')) {
                        unsafeWindow.location.reload();
                        } else {
                        ConfigModal.show(); // 重新打开配置页面以显示更新
                        FilterControls.refresh();
                    }
                } catch (e) {
                    alert(`Error: ${e.message}`);
                }
            };
            
            formDiv.appendChild(form);
            document.body.appendChild(formDiv);
            form.querySelector('#project-name').focus();
        },
        
        deleteProject: (projectName) => {
            if (confirm(`Are you sure you want to delete project "${projectName}"? This action cannot be undone.`)) {
                try {
                    Storage.deleteProject(projectName);
                    ConfigModal.close();
                    ConfigModal.show(); // 重新打开配置页面以显示更新
                FilterControls.refresh();
                } catch (e) {
                    alert(`Error: ${e.message}`);
                }
            }
        },
        
        show: () => {
            if (document.querySelector('.' + CONFIG.CONFIG_MODAL_CLASS)) return;
            
            const modal = ConfigModal.create();
            document.body.appendChild(modal);
        },
        
        close: () => {
            const modal = document.querySelector('.' + CONFIG.CONFIG_MODAL_CLASS);
            if (modal) {
                document.body.removeChild(modal);
            }
        },
        

    };
    
    // UI components
    const UI = {
        createCheckbox: (isEnabled, colors) => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = isEnabled;
            checkbox.style.cssText = `
                width: 16px; height: 16px; margin: 0;
                cursor: pointer; accent-color: ${colors.accent};
            `;
            return checkbox;
        },
        
        createLabel: (colors) => {
            const label = document.createElement('label');
            label.style.cssText = `
                display: flex; align-items: center; gap: 0.5rem; 
                padding: 0.5rem 0.75rem; background: ${colors.background};
                border: 1px solid ${colors.border}; color: ${colors.text};
                border-radius: 4px; cursor: pointer; transition: all 0.2s ease;
                user-select: none; font-size: 14px; margin-right: 0.5rem;
            `;
            label.classList.add('gitlab-files-filter-btn');
            return label;
        },
        
        createContainer: () => {
            const container = document.createElement('div');
            container.className = CONFIG.FILTER_CLASS;
            container.style.cssText = 'margin-left: auto; position: relative; right: 0px;';
            
            const ul = document.createElement('ul');
            ul.classList.add('gl-mb-0', 'gl-pl-0', 'gl-list-style-none');
            ul.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center;';
            
            return { container, ul };
        },
        
        addHoverEffects: (element, colors) => {
            element.addEventListener('mouseenter', () => {
                element.style.background = colors.backgroundHover;
                element.style.borderColor = colors.borderHover;
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.background = colors.background;
                element.style.borderColor = colors.border;
            });
        }
    };
    
    // Main filter controls
    const FilterControls = {
        updateLabelText: (labelTextElement, rule, isEnabled, filterCount) => {
            // 显示计数，无论规则是否启用
            const modeIcon = rule.projectMode === 'include' ? '✅' : '🚫';
            if (filterCount > 0) {
                labelTextElement.textContent = `${modeIcon} ${rule.name} (${filterCount})`;
            } else {
                labelTextElement.textContent = `${modeIcon} ${rule.name}`;
            }
        },
        
        createRuleControl: (rule) => {
            const filterStates = Storage.getFilterStates();
            const isEnabled = filterStates[rule.id] || false;
            const filterCount = FileCollector.getRuleFilesCount(rule.id);
            const colors = Utils.getThemeColors();
            
            const li = document.createElement('li');
            li.classList.add('gl-new-dropdown-item');
            li.style.cssText = 'margin: 0.25rem;';
            
            const label = UI.createLabel(colors);
            const checkbox = UI.createCheckbox(isEnabled, colors);
            
            const labelText = document.createElement('span');
            labelText.style.cssText = 'white-space: nowrap;';
            labelText.id = `filter-text-${rule.id}`;
            
            FilterControls.updateLabelText(labelText, rule, isEnabled, filterCount);
            
            UI.addHoverEffects(label, colors);
            
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                Storage.setFilterState(rule.id, e.target.checked);
                console.log(`[GitLab Files Filter] Filter toggled for ${rule.name}: ${e.target.checked}`);
                // 不再重置计数，保持计数显示
                unsafeWindow.location.reload();
            });
            
            label.appendChild(labelText);
            label.appendChild(checkbox);
            li.appendChild(label);
            
            return li;
        },
        
        createConfigButton: () => {
            const colors = Utils.getThemeColors();
            const li = document.createElement('li');
            li.classList.add('gl-new-dropdown-item');
            li.style.cssText = 'margin: 0.25rem;';
            
            const btn = document.createElement('button');
            const allFilesCount = FileCollector.getAllFilesCount();
            const currentProject = Utils.getCurrentProject();
            
            // 根据项目类型显示不同的按钮文本
            let buttonText = `⚙️ Configure Filters (${allFilesCount} files)`;
            
            // 查找匹配的项目规则
            let matchedProjectRule = null;
            if (currentProject) {
                const projects = Storage.getAllProjects();
                for (const projectRule of projects) {
                    try {
                        const regex = new RegExp(projectRule.projectName);
                        if (regex.test(currentProject)) {
                            matchedProjectRule = projectRule;
                            break;
                        }
                    } catch (e) {
                        // 忽略无效的正则表达式
                    }
                }
            }
            
            if (matchedProjectRule && matchedProjectRule.projectName !== 'Default') {
                buttonText = `⚙️ ${currentProject} Filters (${allFilesCount} files)`;
            } else if (currentProject) {
                buttonText = `⚙️ ${currentProject} Default Filters (${allFilesCount} files)`;
            }
            
            btn.textContent = buttonText;
            btn.style.cssText = `
                display: flex; align-items: center; gap: 0.5rem; 
                padding: 0.5rem 0.75rem; background: ${colors.background};
                border: 1px solid ${colors.border}; color: ${colors.text};
                border-radius: 4px; cursor: pointer; transition: all 0.2s ease;
                user-select: none; font-size: 14px;
            `;
            btn.classList.add('gitlab-files-filter-btn');
            
            UI.addHoverEffects(btn, colors);
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                ConfigModal.show();
            });
            
            li.appendChild(btn);
            return li;
        },
        
        create: () => {
            const rules = Storage.getRules();
            const { container, ul } = UI.createContainer();
            
            // Add rule controls
            rules.forEach(rule => {
                ul.appendChild(FilterControls.createRuleControl(rule));
            });
            
            // Add config button
            ul.appendChild(FilterControls.createConfigButton());
            
            container.appendChild(ul);
            return container;
        },
        
        add: () => {
            if (document.querySelector('.' + CONFIG.FILTER_CLASS)) {
                console.log('[GitLab Files Filter] Filter controls already exist, skipping');
                return;
            }
            
            const topBar = document.querySelector(CONFIG.SELECTORS.TOP_BAR);
            if (topBar) {
                console.log('[GitLab Files Filter] Found top bar, adding filter controls');
                topBar.appendChild(FilterControls.create());
                console.log('[GitLab Files Filter] Filter controls added to page');
            } else {
                console.log('[GitLab Files Filter] Top bar not found, selector: ' + CONFIG.SELECTORS.TOP_BAR);
                console.log('[GitLab Files Filter] Available elements with "top-bar" in class:', document.querySelectorAll('[class*="top-bar"]').length);
            }
        },
        
        refreshAllTexts: () => {
            const rules = Storage.getRules();
            const filterStates = Storage.getFilterStates();
            
            console.log('[GitLab Files Filter] Refreshing all filter texts...');
            
            rules.forEach(rule => {
                const labelTextElement = document.getElementById(`filter-text-${rule.id}`);
                if (labelTextElement) {
                    const isEnabled = filterStates[rule.id] || false;
                    const filterCount = FileCollector.getRuleFilesCount(rule.id);
                    console.log(`[GitLab Files Filter] Updating rule ${rule.name}: enabled=${isEnabled}, count=${filterCount}`);
                    FilterControls.updateLabelText(labelTextElement, rule, isEnabled, filterCount);
                } else {
                    console.log(`[GitLab Files Filter] Label text element not found for rule ${rule.id}`);
                }
            });
            
            // 也更新配置按钮的文件数量
            const configButton = document.querySelector('.gitlab-files-filter-btn');
            if (configButton) {
                const allFilesCount = FileCollector.getAllFilesCount();
                const currentProject = Utils.getCurrentProject();
                
                let buttonText = `⚙️ Configure Filters (${allFilesCount} files)`;
                
                if (currentProject) {
                    const projects = Storage.getAllProjects();
                    for (const projectRule of projects) {
                        try {
                            const regex = new RegExp(projectRule.projectName);
                            if (regex.test(currentProject)) {
                                if (projectRule.projectName !== 'Default') {
                                    buttonText = `⚙️ ${currentProject} Filters (${allFilesCount} files)`;
                                } else {
                                    buttonText = `⚙️ ${currentProject} Default Filters (${allFilesCount} files)`;
                                }
                                break;
                            }
                        } catch (e) {
                            // 忽略无效的正则表达式
                        }
                    }
                }
                
                configButton.textContent = buttonText;
                console.log(`[GitLab Files Filter] Updated config button text: ${buttonText}`);
            }
        },
        
        refresh: () => {
            FilterControls.remove();
            if (Utils.isDiffPage()) {
                FilterControls.add();
            }
        },
        
        remove: () => {
            const controls = document.querySelector('.' + CONFIG.FILTER_CLASS);
            if (controls) {
                controls.remove();
            }
        }
    };
    
    // Page observer
    const PageObserver = {
        init: () => {
            const observer = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                        if (Utils.isDiffPage()) {
                            FilterControls.add();
                        } else {
                            FilterControls.remove();
                        }
                    }
                });
            });
            
            observer.observe(document.body, { attributes: true, subtree: true });
        }
    };
    
    // Initialize storage and handle data migration
    function initStorage() {
        const rules = Storage.getRules();
        const projects = Storage.getAllProjects();
        const currentProject = Utils.getCurrentProject();
        console.log(`[GitLab Files Filter] Loaded ${rules.length} filter rules for project: ${currentProject}`);
        console.log(`[GitLab Files Filter] Loaded ${projects.length} project configurations`);
        
        if (currentProject) {
            const matchedProjectRule = Utils.findMatchingProjectRule(currentProject);
            if (matchedProjectRule && matchedProjectRule.projectName !== 'Default') {
                console.log(`[GitLab Files Filter] Using project-specific rules for ${currentProject} (pattern: ${matchedProjectRule.projectName}): ${matchedProjectRule.rules.map(r => r.name).join(', ')}`);
            } else {
                console.log(`[GitLab Files Filter] Using default rules for project: ${currentProject}`);
            }
        }
    }
    
    // DOM ready initialization
    function initUI() {
        console.log('[GitLab Files Filter] Initializing UI...');
        console.log('[GitLab Files Filter] Current URL:', unsafeWindow.location.href);
        console.log('[GitLab Files Filter] Current project:', Utils.getCurrentProject());
        
        initStorage();
        
        if (Utils.isDiffPage()) {
            console.log('[GitLab Files Filter] Page is diff page, adding filter controls');
            FilterControls.add();
            
            // 主动触发 diffs_metadata.json 请求以获取完整文件列表
            const currentUrl = unsafeWindow.location.href;
            const metadataUrl = currentUrl.replace('/diffs', '/diffs_metadata.json') + '?diff_head=true&view=inline&w=0';
            
            console.log('Triggering diffs_metadata.json request:', metadataUrl);
            
            // 检查是否已经有缓存的metadata请求
            const checkExistingMetadata = () => {
                // 检查网络面板中是否有metadata请求
                if (unsafeWindow.performance && unsafeWindow.performance.getEntriesByType) {
                    const entries = unsafeWindow.performance.getEntriesByType('resource');
                    const metadataEntry = entries.find(entry => 
                        entry.name.includes('diffs_metadata.json')
                    );
                    if (metadataEntry) {
                        console.log('Found existing metadata request in performance entries:', metadataEntry.name);
                        return true;
                    }
                }
                return false;
            };
            
            // 如果没有找到现有的metadata请求，则主动请求
            if (!checkExistingMetadata()) {
                console.log('No existing metadata request found, making active request...');
                
                // 使用fetch主动请求metadata
                unsafeWindow.fetch(metadataUrl)
                    .then(response => response.json())
                    .then(data => {
                        console.log('Active metadata request completed, processing data...');
                        _processMetadataResponse(data, metadataUrl);
                    })
                    .catch(error => {
                        console.log('Error fetching metadata:', error);
                    });
            } else {
                console.log('Existing metadata request found, skipping active request');
            }
            
            // 添加延迟检查机制，确保文件计数能及时更新
            let checkCount = 0;
            const maxChecks = 10; // 最多检查10次
            
            const checkAndUpdateUI = () => {
                checkCount++;
                const totalFiles = MemoryStorage.getTotalFiles();
                const allFilesCount = FileCollector.getAllFilesCount();
                
                console.log(`[GitLab Files Filter] UI update check ${checkCount}/${maxChecks}: totalFiles=${totalFiles}, allFilesCount=${allFilesCount}`);
                
                if (totalFiles > 0 || allFilesCount > 0) {
                    console.log('Files detected, updating UI');
                    FilterControls.refreshAllTexts();
                    FilterControls.refresh();
                    return; // 停止检查
                }
                
                if (checkCount < maxChecks) {
                    // 继续检查，间隔递增
                    setTimeout(checkAndUpdateUI, 1000 * checkCount);
                } else {
                    console.log('Max UI update checks reached, stopping');
                }
            };
            
            // 延迟1秒开始检查
            setTimeout(checkAndUpdateUI, 1000);
        } else {
            console.log('Page is not diff page, skipping filter controls');
        }
        PageObserver.init();
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }
    
    // 在初始化时插入CSS
    if (!document.getElementById('gitlab-files-filter-style')) {
        const style = document.createElement('style');
        style.id = 'gitlab-files-filter-style';
        style.textContent = `
.gitlab-files-filter-container ul {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0; padding: 0;
}
.gitlab-files-filter-btn {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem;
  background: #303030; border: 1px solid #525252; color: #fafafa; border-radius: 4px;
  cursor: pointer; font-size: 14px; height: 36px; box-sizing: border-box; transition: all 0.2s;
}
.gitlab-files-filter-btn input[type='checkbox'] { margin-left: 0.5rem; }
.gitlab-files-filter-btn:focus { outline: 2px solid #1f75cb; }
`;
        document.head.appendChild(style);
    }
    
    // 注册油猴命令
    if (typeof GM_registerMenuCommand !== 'undefined') {
        GM_registerMenuCommand('Clear All GitLab Filter Data', () => {
            if (confirm('Are you sure you want to clear ALL saved data for GitLab Files Filter?\n\nThis will delete:\n• All custom project configurations\n• All filter states\n• All rule configurations\n\nThis action cannot be undone and will reload the page.')) {
                try {
                    // 清理所有版本化的存储键
                    const keys = [CONFIG.RULES_KEY, CONFIG.FILTER_STATES_KEY, CONFIG.PROJECTS_KEY];
                    const versionedKeys = keys.map(key => Storage.getVersionedKey(key));
                    
                    // 删除版本化的键
                    versionedKeys.forEach(key => {
                        try {
                            GM_deleteValue(key);
                            console.log(`[GitLab Files Filter] Deleted versioned key: ${key}`);
                        } catch (e) {
                            console.log(`[GitLab Files Filter] Error deleting versioned key ${key}:`, e);
                        }
                    });
                    
                    // 删除旧版本的键（兼容性）
                    keys.forEach(key => {
                        try {
                            GM_deleteValue(key);
                            console.log(`[GitLab Files Filter] Deleted old key: ${key}`);
                        } catch (e) {
                            console.log(`[GitLab Files Filter] Error deleting old key ${key}:`, e);
                        }
                    });
                    
                    // 清理内存数据
                    MemoryStorage.clearAllData();
                    FileCollector.reset();
                    
                    console.log('All GitLab Files Filter data cleared successfully');
                    alert('All data cleared successfully! The page will now reload.');
                    
                    // 重新加载页面
                    unsafeWindow.location.reload();
                } catch (e) {
                    console.log('Error clearing data:', e);
                    alert(`Error clearing data: ${e.message}`);
                }
            }
        });
        
        console.log('Registered GM menu command: Clear All GitLab Files Filter Data');
    }
    
    console.log(`[GitLab Files Filter] GitLab Files Filter v${CONFIG.VERSION} initialized`);

})();