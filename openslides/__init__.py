#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
    :copyright: 2011, 2012 by OpenSlides team, see AUTHORS.
    :license: GNU GPL, see LICENSE for more details.
"""

VERSION = (1, 3, 0, 'alpha', 1)


def get_version(version=None):
    """
    Derives a PEP386-compliant version number from VERSION. Adds id of
    the current git commit.
    """
    if version is None:
        version = VERSION
    assert len(version) == 5
    assert version[3] in ('alpha', 'beta', 'rc', 'final')

    # Now build the two parts of the version number:
    # main = X.Y[.Z]
    # sub = {a|b|c}N for alpha, beta and rc releases
    #       git's commit id is added

    main_parts = 2 if version[2] == 0 else 3
    main = '.'.join(str(x) for x in version[:main_parts])

    if version[3] != 'final':
        mapping = {'alpha': 'a', 'beta': 'b', 'rc': 'c'}
        sub = mapping[version[3]] + str(version[4])
        try:
            git_head_path = '.git/' + open('.git/HEAD', 'r').read()[5:].rstrip()
            import os
            git_commit_id = open(os.path.abspath(git_head_path), 'r').read().rstrip()
        except IOError:
            git_commit_id = 'unknown'
        sub = '%s commit %s' % (sub, git_commit_id)
    else:
        sub = ''

    return main + sub
