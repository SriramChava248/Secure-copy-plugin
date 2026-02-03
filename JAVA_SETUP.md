# Java 17 System Setup Guide

This project requires **Java 17** (Spring Boot 3.2.0 minimum requirement).

## Setting Java 17 System-Wide (macOS)

### Step 1: Check Available Java Versions
```bash
/usr/libexec/java_home -V
```

You should see Java 17 listed. If not, install it:
```bash
brew install openjdk@17
```

### Step 2: Set Java 17 as Default

**For zsh (default on macOS):**

1. Open your shell profile:
```bash
nano ~/.zshrc
```

2. Add these lines at the end:
```bash
# Set Java 17 as default
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH
```

3. Save and reload:
```bash
source ~/.zshrc
```

**For bash:**

1. Open your shell profile:
```bash
nano ~/.bash_profile
```

2. Add the same lines as above

3. Save and reload:
```bash
source ~/.bash_profile
```

### Step 3: Verify Setup

```bash
# Check Java version
java -version
# Should show: openjdk version "17.0.13"

# Check javac version
javac -version
# Should show: javac 17.0.13

# Check JAVA_HOME
echo $JAVA_HOME
# Should show: /opt/homebrew/Cellar/openjdk@17/17.0.13/libexec/openjdk.jdk/Contents/Home

# Check Maven uses Java 17
mvn -version
# Should show: Java version: 17.0.13
```

### Step 4: Test Build

```bash
mvn clean install -DskipTests
```

Should compile successfully without errors.

## Troubleshooting

**If `java -version` still shows Java 11:**

1. Check which Java is being used:
```bash
which java
```

2. Make sure PATH includes Java 17 first:
```bash
echo $PATH | grep -i java
```

3. Reload your shell:
```bash
source ~/.zshrc  # or ~/.bash_profile
```

**If Maven still uses Java 11:**

1. Check Maven's Java version:
```bash
mvn -version
```

2. If it shows Java 11, make sure JAVA_HOME is set:
```bash
echo $JAVA_HOME
```

3. Restart your terminal to ensure environment variables are loaded.

## Alternative: Using jenv (Java Version Manager)

If you need to switch between Java versions frequently:

1. Install jenv:
```bash
brew install jenv
```

2. Add to ~/.zshrc:
```bash
export PATH="$HOME/.jenv/bin:$PATH"
eval "$(jenv init -)"
```

3. Add Java versions:
```bash
jenv add /opt/homebrew/Cellar/openjdk@17/17.0.13/libexec/openjdk.jdk/Contents/Home
jenv add /opt/homebrew/Cellar/openjdk@11/11.0.25/libexec/openjdk.jdk/Contents/Home
```

4. Set global version:
```bash
jenv global 17.0
```

## Notes

- After setting up, restart your terminal or IDE
- The `start.sh` script no longer sets Java - it uses your system default
- Make sure Java 17 is set before running `./start.sh`


