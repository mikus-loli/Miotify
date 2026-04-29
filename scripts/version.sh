#!/bin/bash

set -e

VERSION_FILE="package.json"

get_current_version() {
    node -p "require('./$VERSION_FILE').version"
}

bump_version() {
    local type=$1
    npm version "$type" -m "chore: release v%s"
    local new_version=$(get_current_version)
    echo "Version bumped to: $new_version"
}

create_tag() {
    local version=$(get_current_version)
    local tag="v$version"
    git tag -a "$tag" -m "Release $tag"
    echo "Created tag: $tag"
}

push_release() {
    local version=$(get_current_version)
    local tag="v$version"
    git push origin main
    git push origin "$tag"
    echo "Pushed release: $tag"
}

show_help() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  current       Show current version"
    echo "  major         Bump major version (1.0.0 -> 2.0.0)"
    echo "  minor         Bump minor version (1.0.0 -> 1.1.0)"
    echo "  patch         Bump patch version (1.0.0 -> 1.0.1)"
    echo "  release       Create and push a new release (tag + push)"
    echo "  tag           Create a git tag for current version"
    echo ""
    echo "Examples:"
    echo "  $0 current"
    echo "  $0 patch"
    echo "  $0 release"
}

case "$1" in
    current)
        echo "Current version: $(get_current_version)"
        ;;
    major|minor|patch)
        bump_version "$1"
        ;;
    tag)
        create_tag
        ;;
    release)
        push_release
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        exit 1
        ;;
esac
