# GitLab Team Assigner

A powerful Tampermonkey/Greasemonkey user script for automatically adding team members as reviewers to GitLab Merge Requests in bulk.

## ✨ Features

- 🚀 **One-Click Team Addition**: Bulk add pre-configured team members as MR reviewers
- 👥 **Multi-Team Management**: Create and manage multiple teams with independent member lists
- 🎯 **Smart Team Matching**: Automatically match teams based on project paths
- 🔄 **Team Switching**: Support manual switching between different teams
- 🧹 **One-Click Clear**: Clear all reviewers with a single click
- 💾 **User ID Caching**: Smart caching of user ID mappings for improved API efficiency
- 🎨 **Theme Adaptation**: Perfect adaptation to GitLab's light and dark themes
- 📝 **Configurable Logging**: Toggle debug logging output on/off
- ⚙️ **Complete Management Interface**: Graphical team management interface
- 🔒 **Strict User Search**: Exact username matching to prevent incorrect assignments
- 🎯 **Project Force Teams**: Override automatic matching for specific projects

## 🚀 Installation

### 1. Install User Script Manager
- **Chrome/Edge**: Install [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- **Firefox**: Install [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/) or [Greasemonkey](https://addons.mozilla.org/en-US/firefox/addon/greasemonkey/)
- **Safari**: Install [Tampermonkey](https://apps.apple.com/us/app/tampermonkey/id1482490089)

### 2. Install Script
1. Open Tampermonkey dashboard
2. Click "Create a new script"
3. Delete default content and paste the entire content of `GitlabExtension_TeamAssign.js`
4. Press `Ctrl+S` to save the script

### 3. Configure Access Permissions
Ensure the script's `@include` rule matches your GitLab domain:
```javascript
// @include      https://git.ringcentral.com/*/-/merge_requests/*
```

## 📖 Usage Guide

### Basic Operations

1. **Open any GitLab Merge Request page**
2. **Buttons will automatically appear in the right-side Reviewer area**:
   - 🔵 **Add [TeamName] (N)**: Add current team members as reviewers
   - 🔽 **Dropdown button (▼)**: Switch teams
   - 🗑️ **Clear All**: Clear all reviewers (only shown when reviewers exist)

### Team Management

#### Access via Menu
- Click the Tampermonkey icon
- Select "Team Management" under "GitLab Team Assigner"

#### Access via Management Interface
- The script provides a comprehensive team management interface accessible through the Tampermonkey menu

### Team Configuration

#### Create New Team
1. Enter team management interface via Tampermonkey menu
2. Click "✨ Create New Team"
3. Fill in team name and member list
4. Configure project matching rules (optional)

#### Edit Existing Team
1. Click on any team in the team management interface
2. Modify team name, members, or project rules
3. Click save

#### Project Matching Rules
- Support configuring project path matching rules for automatic team selection
- Example: `Fiji/Fiji` matches all Fiji projects
- Support multiple rules, one per line

### Member Format Support
Support mixed use of various separators:
- Newline separation: `user1\nuser2\nuser3`
- Comma separation: `user1, user2, user3`
- Space separation: `user1 user2 user3`
- Mixed usage: `user1, user2\nuser3 user4`

## 📝 Logging System

### Feature Description
The script includes a complete logging system with three levels:
- **Info**: General information logs (toggleable)
- **Warning**: Warning logs (toggleable)  
- **Error**: Error logs (always displayed)

### Configuration Methods

#### Method 1: Via Management Interface
1. Open team management interface via Tampermonkey menu
2. Click "⚡ Logging Settings"  
3. Use toggle button to control logging status
4. Click "🔬 Test Logging" to test log output

### View Logs
1. Press `F12` to open browser developer tools
2. Switch to "Console" tab
3. All logs start with "GitLab Team Assigner:"

### Log Level Description
- **Default State**: Logging feature enabled
- **Info/Warning**: Contains operation steps, API calls, user ID caching and other debug information
- **Error**: Contains API errors, user search failures and other critical error information
- **Version Isolation**: Different versions store logging settings independently

## 🔧 Advanced Features

### User ID Caching System
- **Base Mapping**: Built-in ID mapping for common users (daniel.yang, lawrence.huang, etc.)
- **Dynamic Caching**: Automatically cache user IDs found through API searches
- **Smart Search**: Support strict mode username searching (exact matches only)
- **Cache Management**: Support viewing and clearing dynamic cache via management interface

### Project Force Team
- Support forcing specific teams for specific projects
- Force settings have higher priority than automatic matching rules
- Support clearing force settings to restore automatic matching
- Accessible through team selector dropdown

### Versioned Storage
- All data stored independently by script version
- Data automatically isolated during version upgrades
- Avoid data issues caused by version conflicts

### Strict User Search
- Username must match exactly (case-sensitive)
- Prevents accidental assignment of similar usernames
- Clear error messages when exact matches aren't found

## 🎨 Interface Features

### Theme Adaptation
- Perfect support for GitLab light and dark themes
- Automatically adapt to system theme changes
- Maintain consistency with GitLab native interface

### Responsive Design
- Support different screen sizes
- Adaptive button layout
- Mobile-friendly interaction experience

### Dynamic Button States
- Dynamically show/hide buttons based on current MR status
- Smart detection of existing reviewers
- Real-time button state updates

## 🔍 Troubleshooting

### Common Issues

#### 1. Buttons Not Showing
- Confirm you're on a GitLab MR page (not edit page)
- Check if script is correctly installed and enabled
- Refresh page or wait a moment for script to load
- Script skips injection on MR edit pages

#### 2. Adding Reviewer Failed
- Check network connection
- Confirm username spelling is correct (exact match required)
- Check console for error messages
- Confirm you have appropriate permissions for the project

#### 3. User Search Failed
- Username must match exactly (strict mode)
- Confirm user exists in the GitLab instance
- Check if user has access permissions to the project
- Similar usernames will not be automatically assigned

#### 4. Data Loss
- Check if script version has changed
- Different versions store data independently
- You can manually migrate data or reconfigure

### Debugging Steps
1. Enable logging feature via management interface
2. Open browser console (F12)
3. Reproduce the issue and check log output
4. Handle accordingly based on error messages

## 📦 Version History

### v1.1.5 (Current Version)
- 🔒 Enhanced strict user search mode for exact username matching
- 🎯 Improved project force team functionality
- 🔧 Optimized button injection logic with better fallback mechanisms
- 📝 Enhanced error handling and user feedback
- 🎨 Improved theme adaptation and button visibility

### v1.1.1
- ✨ Added configurable logging system
- 🔧 Optimized user ID caching mechanism
- 🎨 Improved interface theme adaptation
- 📝 Enhanced documentation

### v1.1.0
- ✨ Added complete team management interface
- 🔄 Support multi-team switching
- 🎯 Added project matching rules
- 💾 Optimized data storage structure

### v1.0.0
- 🚀 Basic functionality implementation
- 👥 Team member management
- 🔧 Basic API calling functionality

## 🤝 Contributing

Issues and Pull Requests are welcome to improve this project!

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

- **Daniel Yang** - Initial Developer

---

💡 **Tip**: If you encounter any issues or have feature suggestions, please contact us through GitLab Issues!
